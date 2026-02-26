import React from "react";
import { IoMenuOutline } from "react-icons/io5";

interface AboutProps {
  onMenuClick?: () => void;
}

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
    <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4">{title}</div>
    {children}
  </div>
);

export const About: React.FC<AboutProps> = ({ onMenuClick }) => (
  <div className="flex flex-col h-full bg-[#F2F2F7]">
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
      <div className="max-w-3xl mx-auto px-5 py-6 space-y-4">

        {/* Overview */}
        <Section title="Overview">
          <p className="text-xs text-gray-500 leading-relaxed">
            ReadTrack is a hybrid AI system that combines a trained{" "}
            <strong className="text-gray-700">Support Vector Machine (SVM)</strong> with{" "}
            <strong className="text-gray-700">Gemini 2.5 Flash</strong> to assess the reading
            complexity of teaching materials and the writing proficiency of student essays —
            aligned with Philippine curriculum standards (Phil-IRI, DepEd, CEFR).
          </p>
          <div className="mt-4 bg-blue-50 border border-blue-100 rounded-xl p-4 text-xs text-blue-800 leading-relaxed">
            <span className="font-semibold">Complexity</span> measures if a reading material is
            appropriate for Grade 7 students (Literal → easy, Inferential → moderate, Evaluative →
            difficult). <span className="font-semibold">Proficiency</span> is a separate model that
            scores student-written essays and estimates NAT scores. These two models are
            independent.
          </div>
        </Section>

        {/* Tech badges */}
        <Section title="Technology">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: "Algorithm", value: "SVM", color: "text-teal-600 bg-teal-50 border-teal-100" },
              { label: "Kernel", value: "RBF", color: "text-blue-600 bg-blue-50 border-blue-100" },
              { label: "AI Validator", value: "Gemini 2.5 Flash", color: "text-purple-600 bg-purple-50 border-purple-100" },
              { label: "Language", value: "EN & Filipino", color: "text-orange-600 bg-orange-50 border-orange-100" },
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
                Classifies materials as <strong className="text-gray-700">Literal</strong>,{" "}
                <strong className="text-gray-700">Inferential</strong>, or{" "}
                <strong className="text-gray-700">Evaluative</strong> to determine G7 readability.
              </p>
              <div className="space-y-1.5 border-t border-gray-100 pt-3 text-[10px]">
                {[
                  ["Features", "Lexical, Syntactic, Readability"],
                  ["Output", "Literal / Inferential / Evaluative"],
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
                  <div className="text-xs font-bold text-gray-800">Student Proficiency SVM</div>
                  <div className="text-[9px] text-teal-500 font-semibold uppercase tracking-wider">Essay Scoring</div>
                </div>
              </div>
              <p className="text-[11px] text-gray-500 leading-relaxed mb-3">
                Scores student essays as{" "}
                <strong className="text-gray-700">Beginning → Advanced</strong> and estimates
                their <strong className="text-gray-700">NAT score</strong>.
              </p>
              <div className="space-y-1.5 border-t border-gray-100 pt-3 text-[10px]">
                {[
                  ["Output", "Beginning / Developing / Proficient / Advanced"],
                  ["NAT Score", "Estimated 0–100 scale"],
                  ["Standards", "Phil-IRI / DepEd / CEFR"],
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
                Automated Student Assessment Prize 2 — large-scale student essays scored by human
                raters, used to train and validate proficiency and complexity scoring models.
              </p>
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-sm font-bold text-blue-700">CommonLit</span>
                <span className="text-[9px] font-bold text-blue-500 bg-white border border-blue-200 px-1.5 py-0.5 rounded uppercase tracking-wider">Library</span>
              </div>
              <p className="text-[11px] text-blue-800/70 leading-relaxed">
                Curated reading passages graded by complexity level, used to calibrate readability
                indices and lexical difficulty thresholds across grade levels.
              </p>
            </div>
          </div>
        </Section>

        {/* Pipeline */}
        <Section title="Processing Pipeline">
          <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
            {[
              ["Input", "Text / Image / PDF"],
              ["OCR", "Gemini Vision"],
              ["NLP", "spaCy"],
              ["Extract", "Features"],
              ["SVM", "Predict"],
              ["Validate", "Gemini AI"],
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

      </div>
    </div>
  </div>
);
