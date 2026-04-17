import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ComplexityLevel, ProficiencyLevel } from "../types";
import { loadDashboardStats } from "../services/supabaseService";
import { loadStudents } from "./StudentGrading/storage";


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
  label: React.ReactNode;
  count: number;
  colorClass: string;
  bgClass: string;
}

const DistributionChart: React.FC<{
  title: string;
  subtitle?: string;
  rows: DistributionRow[];
  total: number;
}> = ({ title, subtitle, rows, total }) => (
  <div className="bg-white border border-gray-100 rounded-2xl px-5 py-4 shadow-sm">
    <div className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">{title}</div>
    {subtitle && (
      <div className="text-xs text-gray-500 mt-0.5 mb-3">{subtitle}</div>
    )}
    {!subtitle && <div className="mb-3" />}
    <div className="space-y-3">
      {rows.map((row, i) => {
        const pct = total > 0 ? Math.round((row.count / total) * 100) : 0;
        return (
          <div key={i}>
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
  refreshToken?: number;
}

export const Dashboard: React.FC<DashboardProps> = ({ view: _view, refreshToken }) => {
  const navigate = useNavigate();
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [analytics, setAnalytics] = useState({
    totalStudents: 0,
    totalEssays: 0,
    totalMaterials: 0,
    ratedEssays: 0,
    avgTeacherRating: "N/A",
    proficiencyCounts: {
      [ProficiencyLevel.NAGSISIMULA]: 0,
      [ProficiencyLevel.PAPAUNLAD]: 0,
      [ProficiencyLevel.MAHUSAY]: 0,
    },
    complexityCounts: {
      [ComplexityLevel.LITERAL]: 0,
      [ComplexityLevel.INFERENTIAL]: 0,
      [ComplexityLevel.EVALUATIVE]: 0,
    },
  });

  useEffect(() => {
    let cancelled = false;

    // Count students and essays from localStorage (primary store for StudentGrading)
    const localStudents = loadStudents();
    const allEssays = localStudents.flatMap((s) => s.essays);
    const totalStudents = localStudents.filter((s) => s.essays.length > 0).length;
    const totalEssays = allEssays.length;
    const proficiencyCounts = {
      [ProficiencyLevel.NAGSISIMULA]: 0,
      [ProficiencyLevel.PAPAUNLAD]: 0,
      [ProficiencyLevel.MAHUSAY]: 0,
    };
    for (const essay of allEssays) {
      const level = essay.diagnosisResult?.proficiency as ProficiencyLevel | undefined;
      if (level && level in proficiencyCounts) {
        proficiencyCounts[level]++;
      }
    }

    loadDashboardStats().then((stats) => {
      if (!cancelled) {
        setAnalytics({
          totalStudents,
          totalEssays,
          totalMaterials: stats.error ? 0 : stats.totalMaterials,
          ratedEssays: stats.error ? 0 : stats.ratedEssays,
          avgTeacherRating: stats.error ? "N/A" : stats.avgTeacherRating,
          proficiencyCounts,
          complexityCounts: {
            [ComplexityLevel.LITERAL]: stats.error ? 0 : (stats.complexityCounts.Literal || 0),
            [ComplexityLevel.INFERENTIAL]: stats.error ? 0 : (stats.complexityCounts.Inferential || 0),
            [ComplexityLevel.EVALUATIVE]: stats.error ? 0 : (stats.complexityCounts.Evaluative || 0),
          },
        });
        setDashboardLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [refreshToken]);

  const proficiencyRows: DistributionRow[] = [
    {
      label: <><span className="font-bold text-gray-700">Beginning</span><span className="text-[10px] text-gray-400 font-normal"> · Nagsisimula</span></>,
      count: analytics.proficiencyCounts[ProficiencyLevel.NAGSISIMULA],
      colorClass: "bg-red-500",
      bgClass: "bg-red-50",
    },
    {
      label: <><span className="font-bold text-gray-700">Developing</span><span className="text-[10px] text-gray-400 font-normal"> · Papaunlad</span></>,
      count: analytics.proficiencyCounts[ProficiencyLevel.PAPAUNLAD],
      colorClass: "bg-orange-500",
      bgClass: "bg-orange-50",
    },
    {
      label: <><span className="font-bold text-gray-700">Proficient</span><span className="text-[10px] text-gray-400 font-normal"> · Mahusay</span></>,
      count: analytics.proficiencyCounts[ProficiencyLevel.MAHUSAY],
      colorClass: "bg-teal-500",
      bgClass: "bg-teal-50",
    },
  ];

  const complexityRows: DistributionRow[] = [
    {
      label: <><span className="font-bold text-gray-700">Independent</span><span className="text-[10px] text-gray-400 font-normal"> · Easy, G7 Readable</span></>,
      count: analytics.complexityCounts[ComplexityLevel.LITERAL],
      colorClass: "bg-green-500",
      bgClass: "bg-green-50",
    },
    {
      label: <><span className="font-bold text-gray-700">Instructional</span><span className="text-[10px] text-gray-400 font-normal"> · Moderate, Borderline</span></>,
      count: analytics.complexityCounts[ComplexityLevel.INFERENTIAL],
      colorClass: "bg-orange-500",
      bgClass: "bg-orange-50",
    },
    {
      label: <><span className="font-bold text-gray-700">Frustration</span><span className="text-[10px] text-gray-400 font-normal"> · Difficult, Above G7</span></>,
      count: analytics.complexityCounts[ComplexityLevel.EVALUATIVE],
      colorClass: "bg-red-500",
      bgClass: "bg-red-50",
    },
  ];

  if (dashboardLoading) {
    return (
      <main className="flex-1 h-full min-h-0 overflow-y-auto bg-[#F2F2F7]">
        <div className="flex flex-col items-center justify-center h-full">
          <div className="w-8 h-8 rounded-full border-2 border-teal-500 border-t-transparent animate-spin mb-3" />
          <p className="text-sm text-gray-400">Loading dashboard...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 h-full min-h-0 overflow-y-auto bg-[#F2F2F7]">
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
              <p className="text-sm text-gray-400 mt-1">
                Grade 7 Reading Complexity &amp; Proficiency Tracker
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 w-full lg:w-auto lg:min-w-[340px]">
              <MetricCard label="Students" value={analytics.totalStudents} />
              <MetricCard label="Essays" value={analytics.totalEssays} subtitle="submitted for scoring" />
              <MetricCard label="Materials" value={analytics.totalMaterials} subtitle="uploaded to library" />
              <MetricCard label="Avg Teacher Rating" value={analytics.avgTeacherRating} subtitle={`${analytics.ratedEssays} rated`} />
            </div>
          </div>
        </section>

        <section className="grid lg:grid-cols-2 gap-4">
          <DistributionChart
            title="Essay Proficiency"
            subtitle="How well are your students writing?"
            rows={proficiencyRows}
            total={analytics.totalEssays}
          />
          <DistributionChart
            title="Material Complexity"
            subtitle="Are your materials right for Grade 7 students?"
            rows={complexityRows}
            total={analytics.totalMaterials}
          />
        </section>

        <section className="grid sm:grid-cols-2 gap-4">
          <div className="flex flex-col items-start p-6 bg-white border border-gray-100 rounded-2xl shadow-sm gap-3">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl bg-blue-50">📚</div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-blue-500">Complexity</span>
            <div>
              <h3 className="text-sm font-bold text-gray-800 mb-1">Upload a Material</h3>
              <p className="text-xs text-gray-400 leading-relaxed">Check if a reading material is appropriate for Grade 7 students.</p>
            </div>
            <button
              onClick={() => navigate("/material")}
              className="mt-auto w-full py-2 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-xs font-semibold transition-colors"
            >
              Go to Material Library →
            </button>
          </div>
          <div className="flex flex-col items-start p-6 bg-white border border-gray-100 rounded-2xl shadow-sm gap-3">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl bg-teal-50">📝</div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-teal-500">Proficiency</span>
            <div>
              <h3 className="text-sm font-bold text-gray-800 mb-1">Grade an Essay</h3>
              <p className="text-xs text-gray-400 leading-relaxed">Score a student essay and estimate their reading proficiency level.</p>
            </div>
            <button
              onClick={() => navigate("/student")}
              className="mt-auto w-full py-2 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-xs font-semibold transition-colors"
            >
              Go to Essay Scoring →
            </button>
          </div>
        </section>

        <section className="bg-white border border-gray-100 rounded-xl px-4 py-3 shadow-sm">
          <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">How to read this dashboard</div>
          <p className="text-xs text-gray-500 leading-relaxed">
            <span className="font-semibold text-blue-600">Complexity</span> — measures if a reading material is G7-readable.{' '}
            <span className="font-semibold text-teal-600">Proficiency</span> — measures a student's writing quality. These are two separate AI models.{' '}
            See <button onClick={() => navigate("/about")} className="underline text-teal-500 hover:text-teal-600">About</button> for details.
          </p>
        </section>
      </div>
    </main>
  );
};
