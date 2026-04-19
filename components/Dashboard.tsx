import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { IoLibraryOutline, IoPencilOutline, IoArrowForwardOutline } from "react-icons/io5";
import { ComplexityLevel, ProficiencyLevel } from "../types";
import { loadDashboardStats } from "../services/supabaseService";
import { loadStudents } from "./StudentGrading/storage";

interface DashboardProps {
  view: 'welcome' | 'analyzer';
  onMenuClick?: () => void;
  refreshToken?: number;
}

const Stat: React.FC<{ label: string; value: string | number; sub?: string; accent?: string }> = ({
  label, value, sub, accent = 'text-slate-900',
}) => (
  <div className="bg-white rounded-2xl border border-gray-100 px-5 py-4 shadow-sm">
    <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">{label}</div>
    <div className={`text-3xl font-black tabular-nums leading-none ${accent}`}>{value}</div>
    {sub && <div className="text-[11px] text-gray-400 mt-1.5">{sub}</div>}
  </div>
);

interface BarRow {
  label: string;
  sub: string;
  count: number;
  color: string;
  bg: string;
  text: string;
}

const DistBar: React.FC<{ row: BarRow; total: number }> = ({ row, total }) => {
  const pct = total > 0 ? Math.round((row.count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="w-28 shrink-0">
        <div className="text-xs font-semibold text-gray-700 leading-none">{row.label}</div>
        <div className="text-[10px] text-gray-400 mt-0.5">{row.sub}</div>
      </div>
      <div className="flex-1 flex items-center gap-2">
        <div className={`h-2 flex-1 rounded-full ${row.bg} overflow-hidden`}>
          <div
            className={`h-full rounded-full ${row.color} transition-all duration-700`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="w-14 text-right">
          <span className={`text-xs font-bold tabular-nums ${row.text}`}>{row.count}</span>
          <span className="text-[10px] text-gray-400 ml-1">({pct}%)</span>
        </div>
      </div>
    </div>
  );
};

export const Dashboard: React.FC<DashboardProps> = ({ refreshToken }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState({
    totalStudents: 0,
    totalEssays: 0,
    totalMaterials: 0,
    ratedEssays: 0,
    avgTeacherRating: 'N/A' as string | number,
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
    const localStudents = loadStudents();
    const allEssays = localStudents.flatMap(s => s.essays);
    const totalStudents = localStudents.filter(s => s.essays.length > 0).length;
    const totalEssays = allEssays.length;
    const proficiencyCounts = {
      [ProficiencyLevel.NAGSISIMULA]: 0,
      [ProficiencyLevel.PAPAUNLAD]: 0,
      [ProficiencyLevel.MAHUSAY]: 0,
    };
    for (const essay of allEssays) {
      const level = essay.diagnosisResult?.proficiency as ProficiencyLevel | undefined;
      if (level && level in proficiencyCounts) proficiencyCounts[level]++;
    }

    loadDashboardStats().then(stats => {
      if (!cancelled) {
        setAnalytics({
          totalStudents,
          totalEssays,
          totalMaterials: stats.error ? 0 : stats.totalMaterials,
          ratedEssays: stats.error ? 0 : stats.ratedEssays,
          avgTeacherRating: stats.error ? 'N/A' : stats.avgTeacherRating,
          proficiencyCounts,
          complexityCounts: {
            [ComplexityLevel.LITERAL]: stats.error ? 0 : (stats.complexityCounts.Literal || 0),
            [ComplexityLevel.INFERENTIAL]: stats.error ? 0 : (stats.complexityCounts.Inferential || 0),
            [ComplexityLevel.EVALUATIVE]: stats.error ? 0 : (stats.complexityCounts.Evaluative || 0),
          },
        });
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [refreshToken]);

  const profRows: BarRow[] = [
    { label: 'Proficient', sub: 'Mahusay', count: analytics.proficiencyCounts[ProficiencyLevel.MAHUSAY], color: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700' },
    { label: 'Developing', sub: 'Papaunlad', count: analytics.proficiencyCounts[ProficiencyLevel.PAPAUNLAD], color: 'bg-amber-400', bg: 'bg-amber-50', text: 'text-amber-700' },
    { label: 'Beginning', sub: 'Nagsisimula', count: analytics.proficiencyCounts[ProficiencyLevel.NAGSISIMULA], color: 'bg-rose-400', bg: 'bg-rose-50', text: 'text-rose-700' },
  ];

  const matRows: BarRow[] = [
    { label: 'Independent', sub: 'Madali', count: analytics.complexityCounts[ComplexityLevel.LITERAL], color: 'bg-teal-500', bg: 'bg-teal-50', text: 'text-teal-700' },
    { label: 'Instructional', sub: 'Katamtaman', count: analytics.complexityCounts[ComplexityLevel.INFERENTIAL], color: 'bg-amber-400', bg: 'bg-amber-50', text: 'text-amber-700' },
    { label: 'Frustration', sub: 'Mahirap', count: analytics.complexityCounts[ComplexityLevel.EVALUATIVE], color: 'bg-rose-400', bg: 'bg-rose-50', text: 'text-rose-700' },
  ];

  const isEmpty = !loading && analytics.totalStudents === 0 && analytics.totalMaterials === 0;

  if (loading) {
    return (
      <main className="flex-1 h-full min-h-0 overflow-y-auto bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-7 h-7 rounded-full border-2 border-teal-500 border-t-transparent animate-spin" />
          <p className="text-sm text-gray-400">Loading…</p>
        </div>
      </main>
    );
  }

  if (isEmpty) {
    return (
      <main className="flex-1 h-full min-h-0 overflow-y-auto bg-gray-50 flex items-center justify-center">
        <div className="max-w-sm w-full px-6 text-center space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-teal-50 flex items-center justify-center mx-auto">
            <IoLibraryOutline className="text-teal-500 text-3xl" />
          </div>
          <div>
            <h2 className="text-lg font-black text-gray-900">Welcome to ReadTrack</h2>
            <p className="text-sm text-gray-400 mt-1.5 leading-relaxed">
              Get started by uploading a reading passage or adding your first student essay.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => navigate('/material')}
              className="w-full py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold transition-colors cursor-pointer"
            >
              Upload a Reading Passage
            </button>
            <button
              onClick={() => navigate('/student')}
              className="w-full py-2.5 rounded-xl bg-white border border-gray-200 hover:border-indigo-200 text-gray-700 hover:text-indigo-700 text-sm font-semibold transition-colors cursor-pointer"
            >
              Add a Student Essay
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 h-full min-h-0 overflow-y-auto bg-gray-50">
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">

        {/* Page title */}
        <div className="flex items-end justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-teal-600 mb-1">ReadTrack</div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Dashboard</h1>
            <p className="text-sm text-gray-400 mt-0.5">Grade 7 Reading and Writing Snapshot</p>
          </div>
          <span className="text-[11px] text-gray-400 font-medium pb-1">
            {new Date().toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' })}
          </span>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label="Students" value={analytics.totalStudents} sub="with essays" />
          <Stat label="Essays Graded" value={analytics.totalEssays} sub="submissions" />
          <Stat label="Reading Materials" value={analytics.totalMaterials} sub="in library" />
          <Stat
            label="Avg Score"
            value={typeof analytics.avgTeacherRating === 'number' ? `${analytics.avgTeacherRating}/4` : '—'}
            sub={analytics.ratedEssays > 0 ? `from ${analytics.ratedEssays} rated` : 'no ratings yet'}
            accent="text-teal-600"
          />
        </div>

        {/* Charts */}
        <div className="grid lg:grid-cols-2 gap-4">
          {/* Essay proficiency */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-gray-800">Essay Proficiency</div>
                <div className="text-[11px] text-gray-400 mt-0.5">Current writing performance by student.</div>
              </div>
              <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-2 py-1 rounded-full">
                {analytics.totalEssays} total
              </span>
            </div>
            <div className="px-5 py-4 space-y-4">
              {profRows.map(r => (
                <DistBar key={r.label} row={r} total={analytics.totalEssays} />
              ))}
              {analytics.totalEssays === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">No essays graded yet.</p>
              )}
            </div>
          </div>

          {/* Material complexity */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-gray-800">Reading Materials</div>
                <div className="text-[11px] text-gray-400 mt-0.5">How suitable each passage is for Grade 7.</div>
              </div>
              <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-2 py-1 rounded-full">
                {analytics.totalMaterials} total
              </span>
            </div>
            <div className="px-5 py-4 space-y-4">
              {matRows.map(r => (
                <DistBar key={r.label} row={r} total={analytics.totalMaterials} />
              ))}
              {analytics.totalMaterials === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">No materials uploaded yet.</p>
              )}
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid sm:grid-cols-2 gap-3">
          <button
            onClick={() => navigate('/material')}
            className="group text-left bg-white border border-gray-100 rounded-2xl shadow-sm p-5 hover:border-teal-200 hover:shadow-md transition-all cursor-pointer"
          >
            <div className="w-9 h-9 rounded-xl bg-teal-50 flex items-center justify-center mb-3">
              <IoLibraryOutline className="text-teal-600 text-lg" />
            </div>
            <div className="text-xs font-bold uppercase tracking-widest text-teal-600 mb-1">Reading Materials</div>
            <div className="text-sm font-semibold text-gray-800 group-hover:text-teal-700 transition-colors">
              Upload a Reading Passage
            </div>
            <div className="text-xs text-gray-400 mt-1 leading-relaxed">
              Check if a passage is appropriate for Grade 7 readers.
            </div>
            <div className="mt-3 flex items-center gap-1 text-xs font-semibold text-teal-500 group-hover:text-teal-600 transition-colors">
              Open library <IoArrowForwardOutline className="text-xs" />
            </div>
          </button>

          <button
            onClick={() => navigate('/student')}
            className="group text-left bg-white border border-gray-100 rounded-2xl shadow-sm p-5 hover:border-indigo-200 hover:shadow-md transition-all cursor-pointer"
          >
            <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center mb-3">
              <IoPencilOutline className="text-indigo-500 text-lg" />
            </div>
            <div className="text-xs font-bold uppercase tracking-widest text-indigo-500 mb-1">Essay Grading</div>
            <div className="text-sm font-semibold text-gray-800 group-hover:text-indigo-700 transition-colors">
              Grade a Student Essay
            </div>
            <div className="text-xs text-gray-400 mt-1 leading-relaxed">
              Review student writing and record your classroom rating.
            </div>
            <div className="mt-3 flex items-center gap-1 text-xs font-semibold text-indigo-500 group-hover:text-indigo-600 transition-colors">
              Start grading <IoArrowForwardOutline className="text-xs" />
            </div>
          </button>
        </div>

        {/* Legend */}
        <div className="bg-white border border-gray-100 rounded-xl px-4 py-3 shadow-sm">
          <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">How to read the charts above</div>
          <p className="text-xs text-gray-500 leading-relaxed">
            <span className="font-semibold text-teal-600">Reading Materials</span> — shows whether each passage is easy, guided, or challenging for Grade 7.{' '}
            <span className="font-semibold text-indigo-600">Essay Proficiency</span> — shows where students are in their writing development.{' '}
            <button onClick={() => navigate('/about')} className="underline text-teal-500 hover:text-teal-600 transition-colors">
              Learn more
            </button>
          </p>
        </div>
      </div>
    </main>
  );
};
