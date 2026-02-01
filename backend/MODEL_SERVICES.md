# Backend Model Services Overview

This document outlines the different types of models used in the ReadTrack backend, what their purpose is, and where they are located within the project structure.

## 1. Trained Machine Learning Models (SVM)

These are custom models trained on specific datasets to perform classification tasks. They are fast, efficient, and run locally as part of the Python backend.

### a. Student Proficiency SVM

-   **Model Class**: `StudentProficiencySVM`
-   **File Location**: `backend/svm_models.py`
-   **Purpose**: To analyze a student's written text and classify their proficiency level (e.g., Beginning, Developing, Proficient, Advanced).
-   **Services**:
    -   It calculates various linguistic features from the text (vocabulary richness, sentence structure, etc.).
    -   It uses these features to predict a proficiency score and level.
    -   It also includes logic to identify specific `issues` in the text (like weak vocabulary) that can be highlighted on the frontend.
    -   This model is called by the `POST /analyze/student` endpoint.

### b. Text Complexity SVM

-   **Model Class**: `TextComplexitySVM`
-   **File Location**: `backend/svm_models.py`
-   **Purpose**: To analyze a given text and classify its cognitive complexity level (e.g., Literal, Inferential, Evaluative).
-   **Services**:
    -   It assesses features like sentence length and the ratio of difficult words.
    -   It predicts a complexity level to help teachers match texts to student reading levels.
    -   It identifies "difficult words" that can be sent to the frontend as `highlightedSegments`.
    -   This model is called by the `POST /analyze/complexity` and `POST /test-complexity` endpoints.

## 2. Large Language Models (LLM) - via API

The application is also designed to integrate with external Large Language Models (LLMs) like Google's Gemini for more advanced, content-aware analysis. This functionality is currently placeholder and would require API keys to be fully active.

### a. Gemini Service (Content Validation)

-   **Service File**: `services/geminiService.ts` (Note: This is currently on the frontend, but would ideally be a backend-to-backend call to protect API keys).
-   **Purpose**: To perform semantic validation of a student's text against a teacher-provided answer key or reference material.
-   **Services**:
    -   It is not just checking for grammar, but for *meaning*.
    -   It can identify `missingPoints` (concepts from the answer key that the student missed).
    -   It can infer potential `misconceptions` based on how the student discusses the topic.
    -   It provides a high-level `suggestion` for improving content accuracy.
-   **Current Status**: The function `validateContentWithGemini` in `Analyzer.tsx` is where this is called. To make this production-ready, the call should be moved to the Python backend to avoid exposing API keys in the browser.

---

**Summary of Data Flow for Analysis:**

1.  User submits text in `Analyzer.tsx`.
2.  The component makes two parallel calls to the Python backend:
    -   `POST /analyze/student` -> uses `StudentProficiencySVM`.
    -   `POST /analyze/complexity` -> uses `TextComplexitySVM`.
3.  (If a reference key is provided) A call is made to the Gemini service for content validation.
4.  The results from all models are combined and displayed in the UI, with highlights powered by the `issues` and `highlightedSegments` arrays from the backend models.