
import { GoogleGenAI, Type } from "@google/genai";
import { ContentValidation } from "../types";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

const MODEL_NAME = 'gemini-2.5-flash';

/**
 * CONTENT VALIDATION SERVICE
 * 
 * Uses Generative AI to compare student output against a teacher-provided reference.
 * This is the semantic layer of the ReadTrack Hybrid Architecture.
 */

export const validateContentWithGemini = async (
  studentText: string, 
  referenceText?: string,
  referenceFiles?: { mimeType: string; base64: string; name?: string }[]
): Promise<ContentValidation> => {
  
  if ((!referenceText || referenceText.length < 5) && (!referenceFiles || referenceFiles.length === 0)) {
      return {
        hasReference: false,
        accuracyScore: 0,
        missingPoints: [],
        misconceptions: [],
        suggestion: ""
      };
  }

  const prompt = `
    Act as a Teacher's Assistant.
    Compare the STUDENT ANSWER below with the REFERENCE MATERIAL / ANSWER KEY.
    
    STUDENT ANSWER: "${studentText}"
    ${referenceText && referenceText.length > 0 ? `\nREFERENCE MATERIAL (TEXT): "${referenceText}"` : ""}
    ${referenceFiles && referenceFiles.length > 0 ? `\nREFERENCE MATERIAL (FILES): ${referenceFiles.map(f => f.name || 'attached file').join(', ')} (use the attached files)` : ""}
    
    Tasks:
    1. Determine an Accuracy Score (0-100).
       CRITICAL SCORING INSTRUCTION: prioritize the presence of the CORE THOUGHT or INTENT. 
       If the student captures the main idea (the thought is there), consider it correct and give credit, even if the phrasing is imperfect or strictly not identical.
       Do not be overly pedantic about minor details if the fundamental concept is understood.
    2. List Missing Concepts (key points in reference completely absent in student work).
    3. List Misconceptions (conflicting information or errors).
    4. Provide a brief suggestion for improvement.
  `;

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
        hasReference: { type: Type.BOOLEAN },
        accuracyScore: { type: Type.NUMBER },
        missingPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
        misconceptions: { type: Type.ARRAY, items: { type: Type.STRING } },
        suggestion: { type: Type.STRING }
    },
    required: ["hasReference", "accuracyScore", "missingPoints", "misconceptions", "suggestion"]
  };

  try {
    const parts: any[] = [{ text: prompt }];
    if (referenceFiles && referenceFiles.length > 0) {
      referenceFiles.forEach((file) => {
        parts.push({
          inlineData: {
            mimeType: file.mimeType,
            data: file.base64
          }
        });
      });
    }

    const result = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: [{ role: 'user', parts }],
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.2,
      }
    });

    const json = JSON.parse(result.text || '{}');
    return json as ContentValidation;

  } catch (error) {
    console.error("Content Validation Error:", error);
    return {
      hasReference: true,
      accuracyScore: 0,
      missingPoints: ["Error connecting to Content Service"],
      misconceptions: [],
      suggestion: "Please try again later."
    };
  }
};
