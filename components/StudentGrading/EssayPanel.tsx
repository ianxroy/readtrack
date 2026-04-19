import React from 'react';
import { IoCloudUploadOutline, IoStar, IoTrashOutline } from 'react-icons/io5';
import { Student, Subject } from './types';
import { ProficiencyLevel } from '../../types';
import { TrainStatusResponse } from '../../services/pythonService';
import {
  getUILanguagePreference,
  resolveUILanguage,
  subscribeUILanguagePreferenceChange,
} from '../../services/uiSettings';

const PROF_META: Record<string, { pill: string; dot: string; label: string; enLabel: string }> = {
  [ProficiencyLevel.MAHUSAY]:     { pill: 'bg-emerald-50 text-emerald-700 border-emerald-200',  dot: 'bg-emerald-500', label: 'Mahusay',     enLabel: 'Proficient'  },
  [ProficiencyLevel.PAPAUNLAD]:   { pill: 'bg-amber-50 text-amber-700 border-amber-200',        dot: 'bg-amber-400',   label: 'Papaunlad',   enLabel: 'Developing'  },
  [ProficiencyLevel.NAGSISIMULA]: { pill: 'bg-rose-50 text-rose-700 border-rose-200',           dot: 'bg-rose-500',    label: 'Nagsisimula', enLabel: 'Beginning'   },
};

function proficiencyFromOverall(overall: number): ProficiencyLevel {
  if (overall >= 3.5) return ProficiencyLevel.MAHUSAY;
  if (overall >= 2.5) return ProficiencyLevel.PAPAUNLAD;
  return ProficiencyLevel.NAGSISIMULA;
}

interface EssayPanelProps {
  student: Student | null;
  selectedSubject: Subject | null;
  selectedEssayId: string | null;
  onSelectEssay: (essayId: string) => void;
  onUploadEssay: () => void;
  onDeleteEssay: (essayId: string) => void;
  trainStatus?: TrainStatusResponse | null;
}

function ScoreBar({ score, max = 4 }: { score: number; max?: number }) {
  const pct = Math.min(100, (score / max) * 100);
  const color = pct >= 87.5 ? 'bg-emerald-400' : pct >= 62.5 ? 'bg-amber-400' : 'bg-rose-400';
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[9px] font-bold tabular-nums text-gray-400">{score.toFixed(1)}</span>
    </div>
  );
}

export const EssayPanel: React.FC<EssayPanelProps> = ({
  student, selectedSubject, selectedEssayId, onSelectEssay, onUploadEssay, onDeleteEssay, trainStatus,
}) => {
  const [uiLanguagePreference, setUiLanguagePreference] = React.useState(getUILanguagePreference());
  React.useEffect(() => {
    const unsubscribe = subscribeUILanguagePreferenceChange(() => {
      setUiLanguagePreference(getUILanguagePreference());
    });
    return unsubscribe;
  }, []);

  const automaticLanguage: 'english' | 'filipino' = selectedSubject?.language === 'english' ? 'english' : 'filipino';
  const isEnglish = resolveUILanguage(uiLanguagePreference, automaticLanguage) === 'english';
  const visible = !!student;

  const essays = student
    ? selectedSubject
      ? student.essays.filter(e => e.subjectId === selectedSubject.id)
      : student.essays
    : [];

  return (
    <div
      className={`flex-shrink-0 border-l border-gray-100 bg-slate-50 flex flex-col overflow-hidden transition-all duration-300 ease-in-out ${
        visible ? 'w-[220px]' : 'w-0'
      }`}
    >
      {student && (
        <>
          {/* Header */}
          <div className="px-3 pt-3 pb-2.5 border-b border-slate-200/60 flex-shrink-0">
            <div className="flex items-center gap-2 mb-0.5">
              <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-black shrink-0">
                {student.name.trim().charAt(0).toUpperCase()}
              </div>
              <div className="font-bold text-xs text-slate-800 truncate">{student.name}</div>
            </div>
            {selectedSubject && (
              <div className="flex items-center gap-1 ml-8">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isEnglish ? 'bg-sky-400' : 'bg-rose-400'}`} />
                <span className="text-[10px] text-slate-400 truncate">{selectedSubject.name}</span>
              </div>
            )}
          </div>

          {/* Essay count label */}
          <div className="px-3 pt-2 pb-1 flex-shrink-0">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
              Essays · {essays.length}
            </span>
          </div>

          {/* Essay list */}
          <div className="flex-1 overflow-y-auto px-2 pb-2">
            {essays.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-1.5">
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-base">📄</div>
                <p className="text-[10px] text-slate-400 font-medium">No essays yet</p>
              </div>
            ) : (
              <div className="space-y-1">
                {essays.map(essay => {
                  const teacherOverall = essay.teacherRubricScores?.overall;
                  const profLevel = teacherOverall != null
                    ? proficiencyFromOverall(teacherOverall)
                    : essay.diagnosisResult?.proficiency as ProficiencyLevel | undefined;
                  const meta = profLevel ? PROF_META[profLevel] : null;
                  const isActive = selectedEssayId === essay.id;
                  const isAnalyzing = essay.analysisStatus === 'processing';
                  const hasAnalysisError = essay.analysisStatus === 'failed';

                  const langStatus = selectedSubject?.language === 'english'
                    ? trainStatus?.english
                    : trainStatus?.filipino;
                  const isLearning = !essay.teacherRubricScores && langStatus?.confidence_level === 'Natututo pa';

                  return (
                    <div key={essay.id} className="group relative">
                      <button
                        onClick={() => onSelectEssay(essay.id)}
                        className={`w-full text-left px-2.5 py-2 rounded-lg border transition-all ${
                          isActive
                            ? 'bg-indigo-50 border-indigo-200 border-l-2 border-l-indigo-500'
                            : 'bg-white border-slate-100 hover:border-slate-200 border-l-2 border-l-transparent'
                        }`}
                      >
                        <div className={`text-[11px] font-semibold truncate mb-1 ${isActive ? 'text-indigo-800' : 'text-slate-800'}`}>
                          {essay.title}
                        </div>

                        {isAnalyzing && (
                          <div className="mb-1 flex items-center gap-1.5 text-[9px] font-bold text-indigo-600">
                            <span className="w-2.5 h-2.5 rounded-full border border-indigo-400 border-t-transparent animate-spin" />
                            Analyzing in background
                          </div>
                        )}

                        {hasAnalysisError && (
                          <div className="mb-1 text-[9px] font-bold text-rose-600">
                            Analysis failed
                          </div>
                        )}

                        {meta && (
                          <div className="mb-1">
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${meta.pill}`}>
                              {isEnglish ? meta.enLabel : meta.label}
                            </span>
                          </div>
                        )}

                        {teacherOverall != null ? (
                          <ScoreBar score={teacherOverall} max={4} />
                        ) : essay.diagnosisResult?.rubricScore ? (
                          <ScoreBar score={essay.diagnosisResult.rubricScore.overallScore} max={4} />
                        ) : null}

                        <div className="flex items-center justify-between mt-1.5">
                          <span className="text-[9px] text-slate-400">
                            {new Date(essay.uploadedAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                          </span>
                          <div className="flex items-center gap-1">
                            {isLearning && (
                              <span className="text-[9px] text-amber-500" title="System still learning">⚠</span>
                            )}
                            {essay.teacherRubricScores && (
                              <span className="flex items-center gap-0.5 text-[9px] text-amber-500 font-bold">
                                <IoStar className="text-[9px]" />
                                {essay.teacherRubricScores.overall.toFixed(1)}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>

                      <button
                        onClick={e => { e.stopPropagation(); onDeleteEssay(essay.id); }}
                        className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 p-0.5 rounded text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-all"
                        title="Delete essay"
                      >
                        <IoTrashOutline className="text-xs" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Upload button */}
          <div className="p-2 border-t border-slate-200/60 flex-shrink-0">
            <button
              onClick={onUploadEssay}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border-2 border-dashed border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50 text-indigo-400 hover:text-indigo-600 text-[10px] font-bold transition-colors"
            >
              <IoCloudUploadOutline className="text-sm" />
              Upload Essay
            </button>
          </div>
        </>
      )}
    </div>
  );
};
