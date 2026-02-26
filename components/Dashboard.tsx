import React from "react";
import { useNavigate } from "react-router-dom";

interface ToolCardProps {
  title: string;
  description: string;
  badge: string;
  icon: string;
  onClick?: () => void;
  accent: string;
  badgeColor: string;
}

const ToolCard: React.FC<ToolCardProps> = ({ title, description, badge, icon, onClick, accent, badgeColor }) => (
  <button
    onClick={onClick}
    className="group flex flex-col items-start text-left p-6 bg-white border border-gray-100
               rounded-2xl shadow-sm transition-all duration-200 outline-none
               hover:-translate-y-1 hover:shadow-md hover:border-gray-200"
  >
    <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-2xl mb-4 ${accent}`}>
      {icon}
    </div>
    <span className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${badgeColor}`}>{badge}</span>
    <h3 className="text-sm font-bold text-gray-800 mb-1 group-hover:text-teal-600 transition-colors">{title}</h3>
    <p className="text-xs text-gray-400 leading-relaxed">{description}</p>
  </button>
);

interface DashboardProps {
  view: 'welcome' | 'analyzer';
  onMenuClick?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ view: _view }) => {
  const navigate = useNavigate();

  return (
    <main className="flex-1 overflow-y-auto bg-[#F2F2F7]">
      <div className="px-6 pt-16 pb-10 max-w-3xl mx-auto">

        {/* Brand */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-teal-500 shadow-lg mb-5">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
            </svg>
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 mb-2 tracking-tight">
            Welcome to <span className="text-teal-500">ReadTrack</span>
          </h1>
          <p className="text-sm text-gray-400 max-w-xs mx-auto leading-relaxed">
            AI-powered tools for assessing student reading and writing performance.
          </p>
        </div>

        {/* Tool cards */}
        <div className="grid sm:grid-cols-2 gap-4">
          <ToolCard
            title="Material Library"
            description="Upload reading materials and measure if they are appropriate for Grade 7 students using the Complexity SVM."
            badge="Complexity"
            icon="📚"
            accent="bg-blue-50"
            badgeColor="text-blue-500"
            onClick={() => navigate("/material")}
          />
          <ToolCard
            title="Essay Scoring"
            description="Analyze student-written essays, score proficiency level, and estimate NAT scores using the Proficiency SVM."
            badge="Proficiency"
            icon="📝"
            accent="bg-teal-50"
            badgeColor="text-teal-500"
            onClick={() => navigate("/student")}
          />
        </div>

        {/* Distinction note */}
        <div className="mt-5 bg-white border border-gray-100 rounded-xl px-4 py-3 shadow-sm text-xs text-gray-500 leading-relaxed">
          <span className="font-semibold text-blue-600">Complexity</span> — measures if a reading material is G7-readable.&nbsp;
          <span className="font-semibold text-teal-600">Proficiency</span> — measures a student's writing quality and scores their essay.
          These are two separate models. See <button onClick={() => navigate("/about")} className="underline text-teal-500 hover:text-teal-600">About</button> for details.
        </div>

      </div>
    </main>
  );
};
