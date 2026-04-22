import React, { useEffect, useState } from "react";
import { IoMenuOutline } from "react-icons/io5";
import { EvaluationApiResponse } from "../types";

interface AboutProps {
  onMenuClick?: () => void;
}

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
    <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4">{title}</div>
    {children}
  </div>
);

const InfoTooltip: React.FC<{ content: React.ReactNode }> = ({ content }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-flex items-center">
      <button
        onClick={() => setOpen(v => !v)}
        className="ml-1.5 w-3.5 h-3.5 rounded-full bg-gray-200 text-gray-500 text-[8px] font-bold flex items-center justify-center hover:bg-blue-100 hover:text-blue-600 transition-colors"
        aria-label="More info"
      >
        i
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-5 top-0 z-20 w-56 bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-[10px] text-gray-600 leading-relaxed">
            {content}
          </div>
        </>
      )}
    </div>
  );
};

const DEFAULT_METRICS: EvaluationApiResponse = {
  proficiency: {
    accuracy: "85.3%",
    f1: 0.85,
    precision: 0.85,
    recall: 0.85,
    labels: ["Independent", "Instructional", "Frustration"],
    matrix: [],
  },
  complexity: {
    accuracy: "98.41%",
    f1: 0.98,
    precision: 0.98,
    recall: 0.98,
    labels: ["Independent", "Instructional", "Frustration"],
    matrix: [],
  },
};

export const About: React.FC<AboutProps> = ({ onMenuClick }) => {
  const [metrics, setMetrics] = useState<EvaluationApiResponse>(DEFAULT_METRICS);
  const [isOfflineMetrics, setIsOfflineMetrics] = useState(false);

  useEffect(() => {
    const loadMetrics = async () => {
      try {
        const response = await fetch("http://localhost:8000/api/evaluation");
        if (!response.ok) throw new Error("Failed to fetch model metrics");
        const data = await response.json();
        setMetrics(data);
      } catch {
        setIsOfflineMetrics(true);
      }
    };

    loadMetrics();
  }, []);

  return (
    <div className="flex flex-col h-full bg-[#F5F4F0]">
    {/* Header */}
    <header className="h-14 flex items-center gap-3 px-5 border-b border-gray-100 bg-white shadow-sm shrink-0">
      {onMenuClick && (
        <button onClick={onMenuClick} className="md:hidden text-gray-500 hover:text-gray-700">
          <IoMenuOutline className="text-2xl" />
        </button>
      )}
      <h1 className="text-base font-bold text-gray-800">About ReadTrack</h1>
    </header>

    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-5 py-2 space-y-2">

        {/* Overview */}
        <Section title="Overview">
          <p className="text-xs text-gray-500 leading-relaxed">
            ReadTrack uses two trained machine-learning models for classroom analysis:
            one for <strong className="text-gray-700">student proficiency</strong> and one for
            <strong className="text-gray-700"> text complexity</strong>. Input text is processed
            with spaCy + CEFR features, then classified into educational levels. For image/PDF
            inputs, Gemini OCR extracts text before model inference.
          </p>
          <div className="mt-4 bg-blue-50 border border-blue-100 rounded-xl p-4 text-xs text-blue-800 leading-relaxed">
            <span className="font-semibold">Complexity</span> measures if a reading material is
            appropriate for Grade 7 students (Independent → easy, Instructional → moderate, Frustration →
            difficult). <span className="font-semibold">Proficiency</span> classifies student
            writing into Phil-IRI aligned levels (Frustration / Instructional / Independent).
          </div>
        </Section>

        {/* Tech badges */}
        <Section title="Technology">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: "Proficiency Model", value: "HistGradientBoosting", color: "text-teal-600 bg-teal-50 border-teal-100" },
              { label: "Complexity Model", value: "Linear SVC", color: "text-blue-600 bg-blue-50 border-blue-100" },
              { label: "NLP Features", value: "spaCy + CEFRpy", color: "text-purple-600 bg-purple-50 border-purple-100" },
              { label: "OCR", value: "Gemini 2.5 Flash", color: "text-orange-600 bg-orange-50 border-orange-100" },
            ].map(({ label, value, color }) => (
              <div key={label} className={`border rounded-xl p-3 text-center ${color}`}>
                <div className="text-[9px] font-bold uppercase tracking-widest opacity-60 mb-0.5">{label}</div>
                <div className="text-xs font-bold">{value}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* Two models */}
        <Section title="Models">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center text-sm">📊</div>
                <div>
                  <div className="text-xs font-bold text-gray-800">Text Complexity SVM</div>
                  <div className="text-[9px] text-blue-500 font-semibold uppercase tracking-wider">Complexity Detection</div>
                </div>
              </div>
              <p className="text-[11px] text-gray-500 leading-relaxed mb-3">
                Classifies materials as <strong className="text-gray-700">Independent</strong>,{" "}
                <strong className="text-gray-700">Instructional</strong>, or{" "}
                <strong className="text-gray-700">Frustration</strong> (Phil-IRI) to determine G7 readability.
              </p>
              <div className="space-y-1.5 border-t border-gray-100 pt-3 text-[10px]">
                {[
                  ["Algorithm", "SVC (linear kernel)"],
                  ["Features", "24 linguistic + readability features"],
                  ["Output", "Independent / Instructional / Frustration"],
                  ["Indices", "Flesch-Kincaid, Gunning Fog"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-gray-400">{k}</span>
                    <span className="text-gray-600 font-medium">{v}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-teal-50 flex items-center justify-center text-sm">📝</div>
                <div>
                  <div className="text-xs font-bold text-gray-800">Student Proficiency Model</div>
                  <div className="text-[9px] text-teal-500 font-semibold uppercase tracking-wider">Essay Scoring</div>
                </div>
              </div>
              <p className="text-[11px] text-gray-500 leading-relaxed mb-3">
                Classifies student essays into Phil-IRI aligned levels:
                <strong className="text-gray-700"> Frustration</strong>,
                <strong className="text-gray-700"> Instructional</strong>, and
                <strong className="text-gray-700"> Independent</strong>.
              </p>
              <div className="space-y-1.5 border-t border-gray-100 pt-3 text-[10px]">
                {[
                  ["Algorithm", "HistGradientBoosting + RobustScaler"],
                  ["Output", "Frustration / Instructional / Independent"],
                  ["Fallback", "Heuristic scoring when model unavailable"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-gray-400">{k}</span>
                    <span className="text-gray-600 font-medium text-right">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Section>

        {/* Datasets */}
        <Section title="Training Datasets">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="bg-teal-50 border border-teal-100 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-sm font-bold text-teal-700">ASAP2</span>
                <span className="text-[9px] font-bold text-teal-500 bg-white border border-teal-200 px-1.5 py-0.5 rounded uppercase tracking-wider">Kaggle</span>
              </div>
              <p className="text-[11px] text-teal-800/70 leading-relaxed">
                Automated Student Assessment Prize 2 — 24,721 student essays. Human score labels
                are mapped to Frustration / Instructional / Independent for the proficiency model.
              </p>
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-sm font-bold text-blue-700">Phil-IRI</span>
                <span className="text-[9px] font-bold text-blue-500 bg-white border border-blue-200 px-1.5 py-0.5 rounded uppercase tracking-wider">DepEd</span>
              </div>
              <p className="text-[11px] text-blue-800/70 leading-relaxed">
                Philippine Informal Reading Inventory grade-level passages (G4–G10). Labels map
                directly to complexity levels: G4–G6 = Independent, G7 = Instructional, G8–G10 = Frustration.
              </p>
            </div>
          </div>
        </Section>

        <Section title="Feature Set">
          <div className="grid sm:grid-cols-2 gap-3 text-[11px] text-gray-600">
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">
              <div className="font-semibold text-gray-700 mb-1">Core linguistic features</div>
              <p>Type-token ratio, average sentence length, difficult-word ratio, clause density, POS ratios, dependency distance.</p>
            </div>
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">
              <div className="font-semibold text-gray-700 mb-1">Readability + CEFR features</div>
              <p>Flesch-Kincaid, Gunning Fog, CEFR A1–C2 ratios, advanced-word count, stopword and punctuation density.</p>
            </div>
          </div>
        </Section>

        <Section title="Current Metrics">
          <div className="grid sm:grid-cols-2 gap-3 text-[10px]">
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
              <div className="flex items-center mb-2">
                <span className="text-[9px] uppercase tracking-widest text-gray-400 font-bold">Proficiency</span>
                <InfoTooltip content={
                  <>
                    <p className="font-semibold text-gray-700 mb-1">How it's calculated</p>
                    <p className="mb-1.5">Evaluated on a <strong>held-out test split</strong> (15% of ~4,900 Phil-IRI labeled samples). Weighted F1, precision, and recall are computed per-class then averaged by support.</p>
                    <p className="text-orange-600 font-medium">Note: F1 and accuracy may shift as teacher-submitted samples are added to retraining — more data per class generally improves scores.</p>
                  </>
                } />
              </div>
              <div className="space-y-1 text-gray-600">
                <div className="flex justify-between"><span>Accuracy</span><span className="font-semibold">{metrics.proficiency.accuracy}</span></div>
                <div className="flex justify-between"><span>F1</span><span className="font-semibold">{metrics.proficiency.f1}</span></div>
                <div className="flex justify-between"><span>Precision</span><span className="font-semibold">{metrics.proficiency.precision}</span></div>
                <div className="flex justify-between"><span>Recall</span><span className="font-semibold">{metrics.proficiency.recall}</span></div>
              </div>
            </div>
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
              <div className="flex items-center mb-2">
                <span className="text-[9px] uppercase tracking-widest text-gray-400 font-bold">Complexity</span>
                <InfoTooltip content={
                  <>
                    <p className="font-semibold text-gray-700 mb-1">How it's calculated</p>
                    <p className="mb-1.5">Evaluated on a <strong>held-out test split</strong> (~15% of 66 Phil-IRI passages). SVM trained with grid-search cross-validation; metrics are on unseen test samples only.</p>
                    <p className="text-orange-600 font-medium">Note: With a small dataset (66 passages, ~10 test samples), scores are sensitive to the random split. F1 may change significantly as more passages are added.</p>
                  </>
                } />
              </div>
              <div className="space-y-1 text-gray-600">
                <div className="flex justify-between"><span>Accuracy</span><span className="font-semibold">{metrics.complexity.accuracy}</span></div>
                <div className="flex justify-between"><span>F1</span><span className="font-semibold">{metrics.complexity.f1}</span></div>
                <div className="flex justify-between"><span>Precision</span><span className="font-semibold">{metrics.complexity.precision}</span></div>
                <div className="flex justify-between"><span>Recall</span><span className="font-semibold">{metrics.complexity.recall}</span></div>
              </div>
            </div>
          </div>
          {isOfflineMetrics && (
            <div className="mt-3 text-[10px] text-orange-500 font-medium">
              Using cached metrics (backend unavailable).
            </div>
          )}
        </Section>

        {/* Pipeline */}
        <Section title="Processing Pipeline">
          <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
            {[
              ["Input", "Text / Image / PDF"],
              ["OCR", "Gemini Vision"],
              ["Detect", "Language"],
              ["NLP", "spaCy"],
              ["Extract", "Features"],
              ["Model", "Classify"],
              ["Fallback", "Heuristic"],
              ["Output", "Results"],
            ].map(([label, sub], i, arr) => (
              <React.Fragment key={label}>
                <div className="bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-1.5 text-center">
                  <div className="font-bold text-gray-700">{label}</div>
                  <div className="text-gray-400 text-[9px]">{sub}</div>
                </div>
                {i < arr.length - 1 && <span className="text-gray-300 font-bold">›</span>}
              </React.Fragment>
            ))}
          </div>
        </Section>

        {/* Algorithm Visualizer */}
        <Section title="Algorithm Visualizer">
          <p className="text-xs text-gray-500 leading-relaxed mb-3">
            Step-by-step walkthrough of the NLP pipeline — from raw text to SVM classification,
            DepEd verdict, and teacher-driven model retraining. Requires the backend to be running.
          </p>
          <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm">
            <iframe
              src="/algorithm-visualizer.html"
              title="ReadTrack Algorithm Visualizer"
              className="w-full"
              style={{ height: "680px", border: "none" }}
              allow="same-origin"
            />
          </div>
        </Section>

      </div>
    </div>
  </div>
  );
};
