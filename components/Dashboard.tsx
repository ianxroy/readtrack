import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  IoBookOutline,
  IoGridOutline,
  IoInformationCircleOutline,
  IoLibraryOutline,
  IoSchoolOutline,
  IoStarOutline,
  IoArrowForwardOutline,
} from "react-icons/io5";
import { ComplexityLevel, ProficiencyLevel } from "../types";
import { loadDashboardStats } from "../services/supabaseService";
import { loadStudents } from "./StudentGrading/storage";
import { PageHeader, Card, SectionLabel, Spinner } from "./ui/shared";
import { useT } from "../services/i18n";

// ─── Sub-components ────────────────────────────────────────────────────────────

interface MetricCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  accent: string;
  iconBg: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ label, value, subtitle, icon, accent, iconBg }) => (
  <Card padding="px-4 py-3">
    <div className="flex items-start justify-between gap-3">
      <SectionLabel>{label}</SectionLabel>
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
        <span className={`text-sm ${accent}`}>{icon}</span>
      </div>
    </div>
    <div className="text-2xl font-black text-gray-900 mt-1.5 leading-none">{value}</div>
    {subtitle && <div className="text-[11px] text-gray-400 mt-1.5">{subtitle}</div>}
  </Card>
);

interface DistributionRow {
  label: string;
  sublabel: string;
  count: number;
  bar: string;
  bg: string;
}

const DistributionChart: React.FC<{
  title: string;
  subtitle?: string;
  rows: DistributionRow[];
  total: number;
  totalLabel: string;
}> = ({ title, subtitle, rows, total, totalLabel }) => (
  <Card>
    <div className="flex items-start justify-between gap-3 mb-4">
      <div>
        <SectionLabel>{title}</SectionLabel>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full shrink-0">
        {total} {totalLabel}
      </span>
    </div>
    <div className="space-y-3.5">
      {rows.map((row, i) => {
        const pct = total > 0 ? Math.round((row.count / total) * 100) : 0;
        return (
          <div key={i}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-700">{row.label}</span>
                <span className="text-[10px] text-gray-400">{row.sublabel}</span>
              </div>
              <span className="text-xs font-bold text-gray-500 tabular-nums">
                {row.count} <span className="text-gray-300">({pct}%)</span>
              </span>
            </div>
            <div className={`h-1.5 rounded-full overflow-hidden ${row.bg}`}>
              <div
                className={`h-full rounded-full transition-all duration-700 ${row.bar}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  </Card>
);

interface ActionCardProps {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  section: string;
  title: string;
  description: string;
  actionLabel: string;
  onClick: () => void;
}

const ActionCard: React.FC<ActionCardProps> = ({
  icon, iconBg, iconColor, section, title, description, actionLabel, onClick,
}) => (
  <Card className="flex flex-col gap-3 h-full">
    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0 ${iconBg}`}>
      <span className={iconColor}>{icon}</span>
    </div>
    <SectionLabel>{section}</SectionLabel>
    <div className="flex-1">
      <h3 className="text-sm font-bold text-gray-800 mb-1">{title}</h3>
      <p className="text-xs text-gray-500 leading-relaxed">{description}</p>
    </div>
    <button
      onClick={onClick}
      className="w-full py-2 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
    >
      {actionLabel}
      <IoArrowForwardOutline className="text-xs" />
    </button>
  </Card>
);

// ─── Dashboard ─────────────────────────────────────────────────────────────────

interface DashboardProps {
  view: 'welcome' | 'analyzer';
  onMenuClick?: () => void;
  refreshToken?: number;
}

export const Dashboard: React.FC<DashboardProps> = ({ view: _view, onMenuClick, refreshToken }) => {
  const navigate = useNavigate();
  const t = useT();
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

    loadDashboardStats()
      .then(stats => {
        if (cancelled) return;
        setAnalytics({
          totalStudents,
          totalEssays,
          totalMaterials: stats.error ? 0 : stats.totalMaterials,
          ratedEssays: stats.error ? 0 : stats.ratedEssays,
          avgTeacherRating: stats.error ? 'N/A' : stats.avgTeacherRating,
          proficiencyCounts,
          complexityCounts: {
            [ComplexityLevel.LITERAL]:     stats.error ? 0 : (stats.complexityCounts.Literal     || 0),
            [ComplexityLevel.INFERENTIAL]: stats.error ? 0 : (stats.complexityCounts.Inferential || 0),
            [ComplexityLevel.EVALUATIVE]:  stats.error ? 0 : (stats.complexityCounts.Evaluative  || 0),
          },
        });
      })
      .catch(() => {
        if (cancelled) return;
        setAnalytics(prev => ({ ...prev, totalStudents, totalEssays, proficiencyCounts }));
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [refreshToken]);

  const proficiencyRows: DistributionRow[] = [
    { label: t('prof_beginning'), sublabel: '· Beginning',  count: analytics.proficiencyCounts[ProficiencyLevel.NAGSISIMULA], bar: 'bg-rose-500',   bg: 'bg-rose-50'   },
    { label: t('prof_developing'), sublabel: '· Developing', count: analytics.proficiencyCounts[ProficiencyLevel.PAPAUNLAD],   bar: 'bg-amber-500',  bg: 'bg-amber-50'  },
    { label: t('prof_proficient'), sublabel: '· Proficient', count: analytics.proficiencyCounts[ProficiencyLevel.MAHUSAY],     bar: 'bg-teal-500',   bg: 'bg-teal-50'   },
  ];

  const complexityRows: DistributionRow[] = [
    { label: t('level_independent'),   sublabel: '· Easy, G7 Readable',    count: analytics.complexityCounts[ComplexityLevel.LITERAL],     bar: 'bg-green-500',  bg: 'bg-green-50'  },
    { label: t('level_instructional'), sublabel: '· Moderate, Borderline', count: analytics.complexityCounts[ComplexityLevel.INFERENTIAL],  bar: 'bg-orange-500', bg: 'bg-orange-50' },
    { label: t('level_frustration'),   sublabel: '· Difficult, Above G7',  count: analytics.complexityCounts[ComplexityLevel.EVALUATIVE],   bar: 'bg-rose-500',   bg: 'bg-rose-50'   },
  ];

  return (
    <div className="flex flex-col h-full bg-[#F5F4F0]">
      <PageHeader
        icon={<IoGridOutline />}
        title={t('nav_dashboard')}
        badge={analytics.totalStudents}
        onMenuClick={onMenuClick}
      />

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Spinner label={t('dash_loading')} />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-5 py-5 space-y-4">

            {/* Hero */}
            <Card className="border-teal-100 bg-gradient-to-br from-white to-teal-50/40">
              <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5">
                <div>
                  <h2 className="text-2xl font-black text-gray-900 tracking-tight">{t('dash_title')}</h2>
                  <p className="text-sm text-gray-500 mt-1">{t('dash_subtitle')}</p>
                </div>

                <div className="grid grid-cols-2 gap-3 w-full xl:w-[460px] shrink-0">
                  <MetricCard label={t('dash_students')}   value={analytics.totalStudents}     subtitle={t('dash_students_sub')}  icon={<IoSchoolOutline />}  accent="text-teal-600"  iconBg="bg-teal-50"  />
                  <MetricCard label={t('dash_essays')}     value={analytics.totalEssays}       subtitle={t('dash_essays_sub')}    icon={<IoBookOutline />}    accent="text-amber-600" iconBg="bg-amber-50" />
                  <MetricCard label={t('dash_materials')}  value={analytics.totalMaterials}    subtitle={t('dash_materials_sub')} icon={<IoLibraryOutline />} accent="text-sky-600"   iconBg="bg-sky-50"   />
                  <MetricCard label={t('dash_avg_rating')} value={analytics.avgTeacherRating}  subtitle={`${analytics.ratedEssays} ${t('dash_rated_essays')}`} icon={<IoStarOutline />} accent="text-rose-600" iconBg="bg-rose-50" />
                </div>
              </div>
            </Card>

            {/* Distribution charts */}
            <section className="grid xl:grid-cols-2 gap-4">
              <DistributionChart title={t('dash_prof_title')} subtitle={t('dash_prof_sub')} rows={proficiencyRows} total={analytics.totalEssays}     totalLabel={t('dash_total')} />
              <DistributionChart title={t('dash_comp_title')} subtitle={t('dash_comp_sub')} rows={complexityRows}  total={analytics.totalMaterials}   totalLabel={t('dash_total')} />
            </section>

            {/* Quick actions */}
            <section className="grid lg:grid-cols-3 gap-4">
              <ActionCard
                icon={<IoLibraryOutline />} iconBg="bg-sky-50" iconColor="text-sky-600"
                section={t('dash_complexity_lbl')}
                title={t('dash_upload_title')}
                description={t('dash_upload_desc')}
                actionLabel={t('dash_upload_btn')}
                onClick={() => navigate('/material')}
              />
              <ActionCard
                icon={<IoSchoolOutline />} iconBg="bg-teal-50" iconColor="text-teal-600"
                section={t('dash_proficiency_lbl')}
                title={t('dash_grade_title')}
                description={t('dash_grade_desc')}
                actionLabel={t('dash_grade_btn')}
                onClick={() => navigate('/student')}
              />

              <Card className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <IoInformationCircleOutline className="text-teal-500 text-base shrink-0" />
                  <SectionLabel>{t('dash_howto')}</SectionLabel>
                </div>
                <p className="text-xs text-gray-600 leading-relaxed flex-1">
                  {t('dash_howto_desc')}
                </p>
                <button
                  onClick={() => navigate('/about')}
                  className="text-xs font-semibold text-teal-600 hover:text-teal-700 text-left flex items-center gap-1 transition-colors"
                >
                  {t('dash_learn_more')} <IoArrowForwardOutline className="text-xs" />
                </button>
              </Card>
            </section>

          </div>
        </div>
      )}
    </div>
  );
};
