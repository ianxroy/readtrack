import React from "react";
import { CachedAnalysis } from "../types";
import { Header } from "./ui/Header";

import { useState, useRef, useEffect } from "react";
import {
  TextComplexityResult,
  ComplexityLevel,
} from "../types";
import {
  classifyTextComplexityAPI,
} from "../services/pythonService";

import {
  IoSparkles,
  IoCloseCircle,
  IoAttachOutline,
  IoSend,
  IoDocumentText,
  IoInformationCircleOutline,
  IoAlertCircle,
  IoStatsChartOutline,
  IoMenuOutline,
} from "react-icons/io5";

const ResultCard = ({
  title,
  children,
  className = "",
  description,
}: {
  title?: string;
  children?: React.ReactNode;
  className?: string;
  description?: React.ReactNode;
}) => {
  const [showInfo, setShowInfo] = useState(false);

  return (
    <div
      className={`bg-white border border-gray-200 rounded-xl p-4 shadow-sm ${className} relative`}
    >
      {title && (
        <div
          className="flex items-center gap-2 mb-3 group cursor-pointer w-fit"
          onClick={() => description && setShowInfo(!showInfo)}
        >
          <IoInformationCircleOutline className="text-gray-400 group-hover:text-teal-500 transition-colors" />
          <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wide group-hover:text-teal-600 transition-colors">
            {title}
          </h3>
        </div>
      )}

      {showInfo && description && (
        <div className="mb-3 bg-teal-50 text-teal-800 text-[10px] p-2 rounded-lg border border-teal-100 animate-in fade-in slide-in-from-top-1 leading-relaxed">
          {description}
        </div>
      )}

      {children}
    </div>
  );
};

const ComplexityMetricsCard = ({
  result,
}: {
  result: TextComplexityResult;
}) => (
  <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <IoStatsChartOutline className="text-gray-400 text-xs" />
        <h4 className="text-[10px] text-gray-400 uppercase tracking-wider font-normal">
          Simulated Metrics
        </h4>
      </div>
      <div className="space-y-1.5">
        <div className="flex justify-between items-center">
          <span className="text-gray-600 text-xs font-medium">Fixation</span>
          <span className="text-gray-900 font-bold text-xs">
            {result.fixationDuration}%
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-600 text-xs font-medium">
            Regression Index
          </span>
          <span className="text-gray-900 font-bold text-xs">
            {result.regressionIndex}%
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-600 text-xs font-medium">
            Est. Reading Time
          </span>
          <span className="text-gray-900 font-bold text-xs">
            {result.estimatedReadingTime} min
          </span>
        </div>
      </div>
    </div>

    <div>
      <div className="flex items-center gap-2 mb-2">
        <IoStatsChartOutline className="text-gray-400 text-xs" />
        <h4 className="text-[10px] text-gray-400 uppercase tracking-wider font-normal">
          Raw Status
        </h4>
      </div>
      <div className="space-y-1.5">
        <div className="flex justify-between items-center">
          <span className="text-gray-600 text-xs font-medium">Total Words</span>
          <span className="text-gray-900 font-bold text-xs">
            {result.wordCount}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-600 text-xs font-medium">
            Avg Sentence Len
          </span>
          <span className="text-gray-900 font-bold text-xs">
            {result.avgSentenceLength} words
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-600 text-xs font-medium">
            Diff Word Ratio
          </span>
          <span className="text-gray-900 font-bold text-xs">
            {result.difficultWordRatio}%
          </span>
        </div>
      </div>
    </div>
  </div>
);


interface MaterialProps {
  onSaveAnalysis?: (analysis: CachedAnalysis) => void;
  selectedAnalysis?: CachedAnalysis | null;
  onMenuClick: () => void;
}

export const MaterialChecker: React.FC<MaterialProps> = ({
  onSaveAnalysis,
  selectedAnalysis,
  onMenuClick,
}) => {
  const [currentText, setCurrentText] = useState("");
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [complexityResult, setComplexityResult] =
    useState<TextComplexityResult | null>(null);

  const [selectedFile, setSelectedFile] = useState<{
    base64: string;
    mimeType: string;
    name: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const hasResults = !!complexityResult;

  useEffect(() => {
    if (!selectedAnalysis) return;
    setCurrentText(selectedAnalysis.studentText || "");
    setInputText("");
    setComplexityResult(selectedAnalysis.complexityResult || null);
  }, [selectedAnalysis]);

  const handleAnalyze = async () => {
    setErrorMessage(null);

    const textToAnalyze = inputText || currentText;

    if (!textToAnalyze.trim() && !selectedFile) {
      setErrorMessage("Please enter text or upload a document to analyze.");
      return;
    }
    if (!selectedFile && textToAnalyze.trim().length < 15) {
      setErrorMessage("Text is too short. Please provide at least 15 characters.");
      return;
    }

    if (isLoading) return;
    setIsLoading(true);

    setCurrentText(textToAnalyze);
    setInputText("");

    try {
      const comp = await classifyTextComplexityAPI(
        textToAnalyze,
        selectedFile?.base64,
        selectedFile?.mimeType,
      );
      setComplexityResult(comp);

      if (onSaveAnalysis) {
        const firstLine =
          textToAnalyze.split("\n").find((line) => line.trim().length > 0) ||
          "Untitled Analysis";
        const title =
          firstLine.length > 60 ? `${firstLine.slice(0, 60)}...` : firstLine;

        onSaveAnalysis({
          id: Date.now().toString(),
          timestamp: new Date(),
          title,
          studentText: textToAnalyze,
          complexityResult: comp,
        });
      }
    } catch {
      setErrorMessage("Analysis failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAnalyze();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMessage(null);
    const file = e.target.files?.[0];
    if (file) {
      processFileAsStudent(file);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    if (errorMessage) setErrorMessage(null);
  };

  const [isDragging, setIsDragging] = useState(false);

  const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

  const processFileAsStudent = (file: File) => {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setErrorMessage("File size exceeds 10MB limit.");
      return;
    }
    if (file.type === "text/plain") {
      const reader = new FileReader();
      reader.onload = (e) =>
        setInputText((prev) => prev + (e.target?.result as string));
      reader.readAsText(file);
    } else if (file.type.includes("image") || file.type.includes("pdf")) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedFile({
          base64: (reader.result as string).split(",")[1],
          mimeType: file.type,
          name: file.name,
        });
      };
      reader.readAsDataURL(file);
    } else {
      setErrorMessage("Please upload a text file, image, or PDF.");
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    setErrorMessage(null);
  };

  const handleDropToStudent = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processFileAsStudent(files[0]);
    }
    setIsDragging(false);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 min-h-0">
        <Header title="Material Checker" />

        <div
          className="flex-1 overflow-y-auto overflow-x-visible"
          ref={scrollRef}
          style={{ position: "relative" }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {!hasResults && !isLoading && !currentText && (
            <div
              className={`flex flex-col items-center justify-center h-[calc(100vh-200px)] animate-in fade-in zoom-in-95 duration-500 transition-all ${isDragging ? "scale-105" : ""}`}
            >
              <div
                className={`w-20 h-20 bg-teal-50 rounded-2xl flex items-center justify-center mb-6 shadow-sm transition-all ${isDragging ? "bg-teal-100 scale-110 shadow-lg" : ""}`}
              >
                <IoDocumentText
                  className={`text-4xl text-teal-400 transition-all ${isDragging ? "text-teal-600" : ""}`}
                />
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-3">
                {isDragging ? "Drop File Here" : "Ready to Analyze?"}
              </h2>
              <p className="text-gray-400 max-w-md text-center leading-relaxed">
                {isDragging
                  ? "Release to upload your document"
                  : "Upload a document or paste text to get instant readability insights using our Hybrid SVM-AI model."}
              </p>
            </div>
          )}

          {isLoading && (
            <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)]">
              <div className="w-12 h-12 border-4 border-teal-100 border-t-teal-500 rounded-full animate-spin mb-4"></div>
              <p className="text-teal-600 font-medium animate-pulse text-sm">
                Running Python SVM & Gemini Validator...
              </p>
            </div>
          )}

          {hasResults && !isLoading && (
            <div className="flex flex-col lg:flex-row gap-4 p-4 pb-48 max-w-[1800px] mx-auto h-full min-h-full">
              <div
                className="flex-1 bg-white rounded-xl relative border border-gray-100 shadow-sm flex flex-col min-h-[400px]"
                style={{ overflow: "visible" }}
              >

                <div
                  className="prose max-w-none px-6 pb-6 flex-1 overflow-y-auto"
                  onClick={(e) => e.stopPropagation()}
                  style={{ maxHeight: "calc(100vh - 250px)" }}
                >
                  <textarea
                    className="w-full h-full min-h-[300px] resize-none bg-transparent text-sm text-gray-800 placeholder-gray-400 focus:outline-none leading-relaxed"
                    placeholder="Paste reading material here to check if it's suitable for Grade 7 students..."
                    value={inputText || currentText}
                    onChange={(e) => setInputText(e.target.value)}
                  />
                </div>
              </div>

              <div className="w-full lg:w-[360px] shrink-0 space-y-3">
                <ResultCard
                  title="Readability"
                  description={
                    <div className="space-y-1">
                      <p>
                        SVM-based complexity analysis aligned with Grade 7
                        Cognitive Depth Baselines (NLCA/Phil-IRI):
                      </p>
                      <ul className="list-disc pl-3 space-y-1 text-teal-800/90 text-[10px] leading-relaxed">
                        <li>
                          <strong>Literal Comprehension:</strong> Understanding
                          a text's stated facts, ideas, vocabulary, events, and
                          information. It targets questions like "what,"
                          "where," "when," and "who."
                        </li>
                        <li>
                          <strong>Inferential Comprehension:</strong> Making
                          valid inferences from the text—reading between the
                          lines. It answers "why" and "how" questions through
                          implied meaning (e.g., generalizations, comparisons,
                          conclusions, assumptions, predictions,
                          cause-and-effect).
                        </li>
                        <li>
                          <strong>Evaluative Comprehension:</strong> Deeper
                          analysis of the author's intent, opinion, language,
                          and style. It evaluates the appropriateness of devices
                          and makes judgments based on implied ideas.
                        </li>
                      </ul>
                    </div>
                  }
                >
                  <div
                    className={`
                                    py-3 rounded-lg text-center font-bold text-lg mb-1
                                    ${
                                      complexityResult?.level ===
                                      ComplexityLevel.EVALUATIVE
                                        ? "bg-red-50 text-red-700"
                                        : complexityResult?.level ===
                                            ComplexityLevel.INFERENTIAL
                                          ? "bg-orange-50 text-orange-700"
                                          : "bg-green-50 text-green-700"
                                    }
                                 `}
                  >
                    {complexityResult?.level === ComplexityLevel.EVALUATIVE
                      ? "Difficult"
                      : complexityResult?.level}
                  </div>
                  <div className="flex-1 bg-white border border-gray-200 rounded-lg p-2 text-center cursor-pointer hover:border-teal-200 hover:shadow-md transition-all group">
                    <div className="text-[10px] text-gray-400 uppercase font-bold group-hover:text-teal-500">
                      Flesch Kincaid
                    </div>
                    <div className="text-base font-bold text-teal-600">
                      {complexityResult.readability.flesch_kincaid}
                    </div>
                  </div>
                  <div className="flex-1 mt-1 bg-white border border-gray-200 rounded-lg p-2 text-center cursor-pointer hover:border-teal-200 hover:shadow-md transition-all group">
                    <div className="text-[10px] text-gray-400 uppercase font-bold group-hover:text-teal-500">
                      Gunning Fog
                    </div>
                    <div className="text-base font-bold text-teal-600">
                      {complexityResult.readability.gunning_fog}
                    </div>
                  </div>
                </ResultCard>

                {complexityResult && (
                  <ComplexityMetricsCard result={complexityResult} />
                )}
              </div>
            </div>
          )}
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-white via-white to-transparent pointer-events-none flex justify-center z-50">
          <div className="pointer-events-auto w-full max-w-3xl relative flex flex-col items-center">
            {errorMessage && (
              <div className="absolute -top-14 left-0 right-0 flex justify-center z-10 animate-in slide-in-from-bottom-2 fade-in duration-300">
                <div className="bg-red-50 text-red-600 px-3 py-2 rounded-lg text-xs font-medium shadow-sm border border-red-100 flex items-center gap-2 backdrop-blur-sm">
                  <IoAlertCircle className="text-lg shrink-0" />
                  <span>{errorMessage}</span>
                  <button
                    onClick={() => setErrorMessage(null)}
                    className="ml-2 hover:bg-red-100 p-0.5 rounded-full transition-colors"
                  >
                    <IoCloseCircle className="text-base opacity-60 hover:opacity-100" />
                  </button>
                </div>
              </div>
            )}
            {selectedFile && (
              <div className="absolute -top-10 left-0 bg-teal-50 text-teal-700 px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-2 shadow-sm border border-teal-100">
                <span>{selectedFile.name}</span>
                <button
                  onClick={() => setSelectedFile(null)}
                  className="hover:text-red-500"
                >
                  <IoCloseCircle />
                </button>
              </div>
            )}

            <div
              className={`
                          w-full
                          bg-white rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.08)] border transition-all flex items-center p-1.5 pr-1.5 relative group
                          ${errorMessage ? "border-red-200 ring-2 ring-red-50" : "border-gray-200"}
                          ${isDragging ? "ring-2 ring-teal-400 border-teal-400 bg-teal-50" : ""}
                      `}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                onChange={handleFileSelect}
                accept=".txt,image/*,.pdf"
              />

              <textarea
                value={inputText}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={
                  isDragging ? "Drop file here..." : "Type or paste text..."
                }
                className="flex-1 bg-transparent border-none focus:ring-0 outline-none focus:outline-none text-gray-700 ml-4 placeholder-gray-400 py-2 resize-none h-[40px] leading-[20px] text-sm"
              />

              <div className="flex items-center gap-1 pr-1">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 text-gray-400 hover:text-teal-600 transition-colors rounded-full hover:bg-gray-100"
                >
                  <IoAttachOutline className="text-lg rotate-45" />
                </button>
                <button
                  onClick={handleAnalyze}
                  disabled={(!inputText.trim() && !selectedFile) || isLoading}
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                    (inputText.trim() || selectedFile) && !isLoading
                      ? "bg-teal-500 text-white shadow-md hover:bg-teal-600"
                      : "bg-gray-100 text-gray-300"
                  }`}
                >
                  {isLoading ? (
                    <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <IoSend className="ml-0.5 text-sm" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
