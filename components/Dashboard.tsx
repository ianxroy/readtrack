import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ComplexityLevel, ProficiencyLevel } from "../types";
import { loadDashboardStats } from "../services/supabaseService";

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

interface MetricCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ label, value, subtitle }) => (
  <div className="bg-white border border-gray-100 rounded-2xl px-4 py-4 shadow-sm">
    <div className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">{label}</div>
    <div className="text-2xl font-black text-gray-900 mt-1">{value}</div>
    {subtitle && <div className="text-[11px] text-gray-400 mt-1">{subtitle}</div>}
  </div>
);

interface DistributionRow {
  label: string;
  count: number;
  colorClass: string;
  bgClass: string;
}

const DistributionChart: React.FC<{
  title: string;
  rows: DistributionRow[];
  total: number;
}> = ({ title, rows, total }) => (
  <div className="bg-white border border-gray-100 rounded-2xl px-5 py-4 shadow-sm">
    <div className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-3">{title}</div>
    <div className="space-y-3">
      {rows.map((row) => {
        const pct = total > 0 ? Math.round((row.count / total) * 100) : 0;
        return (
          <div key={row.label}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-gray-700 font-semibold">{row.label}</span>
              <span className="text-gray-500 font-bold">{row.count} ({pct}%)</span>
            </div>
            <div className={`h-2 rounded-full overflow-hidden ${row.bgClass}`}>
              <div className={`h-full rounded-full ${row.colorClass}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

interface DashboardProps {
  view: 'welcome' | 'analyzer';
  onMenuClick?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ view: _view }) => {
  const navigate = useNavigate();
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [analytics, setAnalytics] = useState({
    totalStudents: 0,
    totalEssays: 0,
    totalMaterials: 0,
    ratedEssays: 0,
    avgTeacherRating: "N/A",
    proficiencyCounts: {
      [ProficiencyLevel.FRUSTRATION]: 0,
      [ProficiencyLevel.INSTRUCTIONAL]: 0,
      [ProficiencyLevel.INDEPENDENT]: 0,
    },
    complexityCounts: {
      [ComplexityLevel.LITERAL]: 0,
      [ComplexityLevel.INFERENTIAL]: 0,
      [ComplexityLevel.EVALUATIVE]: 0,
    },
  });

  useEffect(() => {
    let cancelled = false;
    loadDashboardStats().then((stats) => {
      if (!cancelled && !stats.error) {
        setAnalytics({
          totalStudents: stats.totalStudents,
          totalEssays: stats.totalEssays,
          totalMaterials: stats.totalMaterials,
          ratedEssays: stats.ratedEssays,
          avgTeacherRating: stats.avgTeacherRating,
          proficiencyCounts: {
            [ProficiencyLevel.FRUSTRATION]: stats.proficiencyCounts.Frustration || 0,
            [ProficiencyLevel.INSTRUCTIONAL]: stats.proficiencyCounts.Instructional || 0,
            [ProficiencyLevel.INDEPENDENT]: stats.proficiencyCounts.Independent || 0,
          },
          complexityCounts: {
            [ComplexityLevel.LITERAL]: stats.complexityCounts.Literal || 0,
            [ComplexityLevel.INFERENTIAL]: stats.complexityCounts.Inferential || 0,
            [ComplexityLevel.EVALUATIVE]: stats.complexityCounts.Evaluative || 0,
          },
        });
      }
      if (!cancelled) setDashboardLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const proficiencyRows: DistributionRow[] = [
    {
      label: ProficiencyLevel.FRUSTRATION,
      count: analytics.proficiencyCounts[ProficiencyLevel.FRUSTRATION],
      colorClass: "bg-red-500",
      bgClass: "bg-red-50",
    },
    {
      label: ProficiencyLevel.INSTRUCTIONAL,
      count: analytics.proficiencyCounts[ProficiencyLevel.INSTRUCTIONAL],
      colorClass: "bg-orange-500",
      bgClass: "bg-orange-50",
    },
    {
      label: ProficiencyLevel.INDEPENDENT,
      count: analytics.proficiencyCounts[ProficiencyLevel.INDEPENDENT],
      colorClass: "bg-teal-500",
      bgClass: "bg-teal-50",
    },
  ];

  const complexityRows: DistributionRow[] = [
    {
      label: ComplexityLevel.LITERAL,
      count: analytics.complexityCounts[ComplexityLevel.LITERAL],
      colorClass: "bg-green-500",
      bgClass: "bg-green-50",
    },
    {
      label: ComplexityLevel.INFERENTIAL,
      count: analytics.complexityCounts[ComplexityLevel.INFERENTIAL],
      colorClass: "bg-orange-500",
      bgClass: "bg-orange-50",
    },
    {
      label: ComplexityLevel.EVALUATIVE,
      count: analytics.complexityCounts[ComplexityLevel.EVALUATIVE],
      colorClass: "bg-red-500",
      bgClass: "bg-red-50",
    },
  ];

  if (dashboardLoading) {
    return (
      <main className="flex-1 overflow-y-auto bg-[#F2F2F7]">
        <div className="flex flex-col items-center justify-center h-full">
          <div className="w-8 h-8 rounded-full border-2 border-teal-500 border-t-transparent animate-spin mb-3" />
          <p className="text-sm text-gray-400">Loading dashboard...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-y-auto bg-[#F2F2F7]">
      <div className="px-6 pt-10 pb-10 max-w-6xl mx-auto space-y-5">
        <section className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-teal-600 bg-teal-50 border border-teal-100 rounded-full px-3 py-1 mb-3">
                ReadTrack Analytics
              </div>
              <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
                Dashboard Overview
              </h1>
              <p className="text-sm text-gray-500 mt-2 max-w-xl">
                Monitor essay proficiency, material complexity, and teacher scoring trends in one view.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 w-full lg:w-auto lg:min-w-[340px]">
              <MetricCard label="Students" value={analytics.totalStudents} />
              <MetricCard label="Essays" value={analytics.totalEssays} />
              <MetricCard label="Materials" value={analytics.totalMaterials} />
              <MetricCard label="Avg Teacher Rating" value={analytics.avgTeacherRating} subtitle={`${analytics.ratedEssays} rated`} />
            </div>
          </div>
        </section>

        <section className="grid lg:grid-cols-2 gap-4">
          <DistributionChart
            title="Essay Proficiency Graph"
            rows={proficiencyRows}
            total={analytics.totalEssays}
          />
          <DistributionChart
            title="Material Complexity Graph"
            rows={complexityRows}
            total={analytics.totalMaterials}
          />
        </section>

        <section className="grid sm:grid-cols-2 gap-4">
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
        </section>

        <section className="bg-white border border-gray-100 rounded-xl px-4 py-3 shadow-sm text-xs text-gray-500 leading-relaxed">
          <span className="font-semibold text-blue-600">Complexity</span> — measures if a reading material is G7-readable.&nbsp;
          <span className="font-semibold text-teal-600">Proficiency</span> — measures a student's writing quality and scores their essay.
          These are two separate models. See <button onClick={() => navigate("/about")} className="underline text-teal-500 hover:text-teal-600">About</button> for details.
        </section>
      </div>
    </main>
  );
};
