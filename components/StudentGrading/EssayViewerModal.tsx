import React, { useState, useEffect } from 'react';
import {
  IoPersonCircleOutline,
  IoCloseOutline,
  IoStatsChartOutline,
  IoCheckmarkCircleOutline,
  IoBookOutline,
  IoStar,
  IoStarOutline,
} from 'react-icons/io5';

import { Student, Subject, StudentEssay, TeacherRubricScores } from './types';
import { GrammarHighlightedText } from './GrammarHighlightedText';
import {
  ProficiencyLevel,
  DepEdRubricScore,
} from '../../types';

interface EssayViewerModalProps {
  student: Student;
  essay: StudentEssay;
  subject: Subject | null;
  onSaveEvaluation: (essayId: string, rubricScores: TeacherRubricScores, comment: string) => Promise<void>;
  onClose: () => void;
}

const proficiencyMeta = {
  [ProficiencyLevel.NAGSISIMULA]: {
    color: 'text-red-600',
    bg: 'bg-red-50',
    border: 'border-red-100',
    dot: 'bg-red-500',
  },
  [ProficiencyLevel.PAPAUNLAD]: {
    color: 'text-orange-600',
    bg: 'bg-orange-50',
    border: 'border-orange-100',
    dot: 'bg-orange-500',
  },
  [ProficiencyLevel.MAHUSAY]: {
    color: 'text-teal-600',
    bg: 'bg-teal-50',
    border: 'border-teal-100',
    dot: 'bg-teal-500',
  },
};


const DIMENSION_META = {
  content:      { labelFil: 'Nilalaman',           label: 'Content',       color: 'indigo' },
  organization: { labelFil: 'Organisasyon',         label: 'Organization',  color: 'teal'   },
  languageVocab:{ labelFil: 'Wika/Talasalitaan',    label: 'Language',      color: 'violet' },
  grammar:      { labelFil: 'Gramatika',            label: 'Grammar',       color: 'amber'  },
  mechanics:    { labelFil: 'Mekanika',             label: 'Mechanics',     color: 'rose'   },
} as const;

const SCORE_LABEL: Record<number, string> = {
  1: 'Nagsisimula',
  2: 'Papaunlad',
  3: 'Papalapit sa Kahusayan',
  4: 'Mahusay',
};

function ScorePips({ score }: { score: number }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4].map(n => (
        <div
          key={n}
          className={`w-2.5 h-2.5 rounded-full transition-colors ${
            n <= score ? 'bg-teal-500' : 'bg-gray-200'
          }`}
        />
      ))}
    </div>
  );
}

function DepEdRubricPanel({ rubric }: { rubric: DepEdRubricScore }) {
  const dims = (['content', 'organization', 'languageVocab', 'grammar', 'mechanics'] as const);
  const langLabel = rubric.language === 'filipino' ? 'Filipino' : 'English';

  return (
    <div className="bg-white border border-gray-100 rounded-[24px] p-6 shadow-sm space-y-5">
      <div className="flex items-center justify-between">
        <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
          <IoStatsChartOutline className="text-indigo-400" />
          DepEd Rubrik · {rubric.gradeLevel} · {langLabel}
        </h4>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-gray-500 font-medium">Kabuuan</span>
          <span className="text-lg font-black text-indigo-600">
            {rubric.overallScore.toFixed(1)}
            <span className="text-xs font-normal text-gray-400">/4</span>
          </span>
        </div>
      </div>

      <div className="space-y-4">
        {dims.map(dim => {
          const meta = DIMENSION_META[dim];
          const d = rubric[dim];
          return (
            <div key={dim}>
              <div className="flex items-center justify-between mb-1">
                <div>
                  <span className="text-xs font-bold text-gray-700">{meta.labelFil}</span>
                  <span className="text-[10px] text-gray-400 ml-1">({meta.label})</span>
                </div>
                <span className="text-[10px] font-bold text-gray-500">
                  {d.score}/4 · {SCORE_LABEL[d.score] ?? ''}
                </span>
              </div>
              <ScorePips score={d.score} />
              <p className="text-[10px] text-gray-500 mt-1 leading-relaxed">{d.rationale}</p>
            </div>
          );
        })}
      </div>

      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
        <p className="text-[11px] text-indigo-900 leading-relaxed font-medium">
          {rubric.overallFeedback}
        </p>
      </div>
    </div>
  );
}

function formatStudentName(value: string): string {
  return value?.trim() || 'Student';
}

export const EssayViewerModal: React.FC<EssayViewerModalProps> = ({
  student,
  essay,
  subject,
  onSaveEvaluation,
  onClose,
}) => {
  const defaultDims = { content: 0, organization: 0, languageVocab: 0, grammar: 0, mechanics: 0 };

  const [teacherDims, setTeacherDims] = useState<typeof defaultDims>(
    essay.teacherRubricScores
      ? {
          content:      essay.teacherRubricScores.content,
          organization: essay.teacherRubricScores.organization,
          languageVocab:essay.teacherRubricScores.languageVocab,
          grammar:      essay.teacherRubricScores.grammar,
          mechanics:    essay.teacherRubricScores.mechanics,
        }
      : { ...defaultDims }
  );
  const [teacherComment, setTeacherComment] = useState(essay.teacherComment ?? '');
  const [isSavingEvaluation, setIsSavingEvaluation] = useState(false);
  const [evaluationMessage, setEvaluationMessage] = useState<string | null>(null);
  const [evaluationError, setEvaluationError] = useState(false);
  const [activeTab, setActiveTab] = useState<'original' | 'analysis'>('original');

  useEffect(() => {
    setTeacherDims(
      essay.teacherRubricScores
        ? {
            content:      essay.teacherRubricScores.content,
            organization: essay.teacherRubricScores.organization,
            languageVocab:essay.teacherRubricScores.languageVocab,
            grammar:      essay.teacherRubricScores.grammar,
            mechanics:    essay.teacherRubricScores.mechanics,
          }
        : { ...defaultDims }
    );
    setTeacherComment(essay.teacherComment ?? '');
    setEvaluationMessage(null);
    setActiveTab('original');
  }, [essay.id]);

  const handleSaveTeacherEvaluation = async () => {
    const dims = ['content', 'organization', 'languageVocab', 'grammar', 'mechanics'] as const;
    const allSet = dims.every(d => teacherDims[d] >= 1 && teacherDims[d] <= 4);
    if (!allSet) {
      setEvaluationError(true);
      setEvaluationMessage('I-rate ang lahat ng 5 dimensyon bago i-save.');
      return;
    }
    setIsSavingEvaluation(true);
    setEvaluationMessage(null);
    try {
      const overall = parseFloat(
        (dims.reduce((sum, d) => sum + teacherDims[d], 0) / 5).toFixed(2)
      );
      const percentage = parseFloat(((overall / 4) * 100).toFixed(2));
      const transmuted = percentage >= 60
        ? parseFloat((((percentage - 60) / 40) * 25 + 75).toFixed(2))
        : parseFloat((((percentage) / 60) * 74).toFixed(2));

      const rubricScores: TeacherRubricScores = {
        ...teacherDims,
        overall,
        percentage,
        transmuted,
      };
      await onSaveEvaluation(essay.id, rubricScores, teacherComment.trim());
      setEvaluationError(false);
      setEvaluationMessage('Nai-save ang marka ng guro.');
    } catch {
      setEvaluationError(true);
      setEvaluationMessage('Hindi nai-save. Subukan muli.');
    } finally {
      setIsSavingEvaluation(false);
    }
  };

  const SAFE_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
  const safeImageMime = essay.originalFile?.mimeType && SAFE_IMAGE_TYPES.has(essay.originalFile.mimeType)
    ? essay.originalFile.mimeType
    : null;

  const dr = essay.diagnosisResult;
  const pMeta = dr ? proficiencyMeta[dr.proficiency] : null;

  const teacherProficiency = essay.teacherRubricScores
    ? essay.teacherRubricScores.overall >= 3.5 ? ProficiencyLevel.MAHUSAY
      : essay.teacherRubricScores.overall >= 2.5 ? ProficiencyLevel.PAPAUNLAD
      : ProficiencyLevel.NAGSISIMULA
    : null;
  const teacherPMeta = teacherProficiency ? proficiencyMeta[teacherProficiency] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-[32px] shadow-2xl border border-white/20 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between p-8 border-b border-gray-50">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 text-teal-700 border border-teal-100 text-[10px] font-black uppercase tracking-widest">
                <IoPersonCircleOutline /> {formatStudentName(student.name)}
              </div>
              {subject && (
                <div className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                  {subject.name}
                </div>
              )}
              {dr && (
                <span
                  className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${pMeta?.bg} ${pMeta?.color} ${pMeta?.border}`}
                >
                  {dr.proficiency}
                </span>
              )}
            </div>
            <h2 className="text-2xl font-black text-gray-900 tracking-tight truncate">
              {essay.title}
            </h2>
            <p className="text-sm text-gray-400 font-medium mt-1">
              Sinuri noong {(essay.uploadedAt instanceof Date ? essay.uploadedAt : new Date(essay.uploadedAt as unknown as string)).toLocaleString()} {/* Analyzed on */}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={onClose}
              className="p-3 rounded-2xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
            >
              <IoCloseOutline className="text-2xl" />
            </button>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="flex border-b border-gray-200 px-4">
          {(['original', 'analysis'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'original' ? 'Original Submission' : 'Analysis'}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          {/* Original Submission Tab */}
          {activeTab === 'original' && (
            <div>
              <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4 flex items-center gap-2">
                <IoBookOutline /> Orihinal na Isinumite {/* Original Submission */}
              </h4>
              {essay.originalFile ? (
                <div className="flex gap-4">
                  {/* Left: original file */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase mb-2">Original File</p>
                    {safeImageMime ? (
                      <img
                        src={`data:${safeImageMime};base64,${essay.originalFile!.base64}`}
                        alt="Original submission"
                        className="w-full rounded-lg border border-gray-200"
                      />
                    ) : (
                      <div className="text-xs text-gray-400 italic p-4 bg-gray-50 rounded-lg border border-gray-200">
                        No preview available for this file type.
                      </div>
                    )}
                  </div>
                  {/* Right: extracted text */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase mb-2">Extracted Text</p>
                    <GrammarHighlightedText text={essay.text} issues={dr?.issues ?? []} />
                  </div>
                </div>
              ) : (
                <GrammarHighlightedText text={essay.text} issues={dr?.issues ?? []} />
              )}
            </div>
          )}

          {/* Analysis Tab */}
          {activeTab === 'analysis' && (
            <div className="space-y-8">
              {/* DepEd Rubric — primary evaluation */}
              {dr?.rubricScore && (
                <DepEdRubricPanel rubric={dr.rubricScore} />
              )}

              {/* Scoring Grid */}
              {dr && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Mungkahing Marka — AI predicted + teacher actual */}
                  <div className="p-4 rounded-2xl border border-blue-100 bg-blue-50 md:col-span-2">
                    <div className="flex items-center gap-2 mb-3">
                      <IoStatsChartOutline className="text-xs text-blue-600" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-blue-600">Mungkahing Marka</span>
                    </div>
                    <div className="flex items-start gap-6">
                      <div className="flex-1">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Hinulaang (AI)</p>
                        <p className="text-xl font-black text-blue-600">
                          {dr.rubricScore ? `${dr.rubricScore.overallScore.toFixed(1)}/4` : `${dr.natScore}%`}
                        </p>
                        <p className="mt-1 text-[11px] text-gray-500 leading-relaxed">
                          Numerikong antas ng kasanayan batay sa kayamanan ng wika at istrukturang pagkakaisa.
                        </p>
                      </div>
                      {essay.teacherRubricScores ? (
                        <>
                          <div className="w-px self-stretch bg-blue-200" />
                          <div className="flex-1">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Aktwal (Guro)</p>
                            <p className="text-xl font-black text-blue-600">
                              {essay.teacherRubricScores.overall.toFixed(1)}/4
                              <span className="text-xs font-normal text-gray-400 ml-2">
                                ({essay.teacherRubricScores.percentage.toFixed(0)}%
                                {essay.teacherRubricScores.transmuted != null && ` · ${essay.teacherRubricScores.transmuted.toFixed(0)} transmuted`})
                              </span>
                            </p>
                            <p className="mt-1 text-[11px] text-gray-500 leading-relaxed">
                              Marka ng guro batay sa 5-dimensyong rubrik ng DepEd.
                            </p>
                          </div>
                        </>
                      ) : (
                        <div className="flex-1 flex items-center justify-center">
                          <p className="text-[10px] text-gray-400 italic">I-rate ang sanaysay para makita ang aktwal na marka.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {[
                  ].map((item, idx) => (
                    <div
                      key={idx}
                      className={`p-4 rounded-2xl border ${item.meta?.border || 'border-gray-100'} ${item.meta?.bg || 'bg-gray-50'}`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <item.icon
                          className={`text-xs ${item.meta?.color || 'text-gray-400'}`}
                        />
                        <span
                          className={`text-[10px] font-bold uppercase tracking-widest ${item.meta?.color || 'text-gray-400'}`}
                        >
                          {item.label}
                        </span>
                      </div>
                      <div
                        className={`text-xl font-black ${item.meta?.color || 'text-gray-900'}`}
                      >
                        {item.value}
                      </div>
                      <p className="mt-2 text-[11px] text-gray-600 leading-relaxed">
                        {item.definition}
                      </p>
                    </div>
                  ))}

                  {/* Antas ng Kahusayan — predicted (AI) + actual (teacher) */}
                  {dr && (
                    <div className={`p-4 rounded-2xl border col-span-full ${pMeta?.border || 'border-gray-100'} ${pMeta?.bg || 'bg-gray-50'}`}>
                      <div className="flex items-center gap-2 mb-3">
                        <IoCheckmarkCircleOutline className={`text-xs ${pMeta?.color || 'text-gray-400'}`} />
                        <span className={`text-[10px] font-bold uppercase tracking-widest ${pMeta?.color || 'text-gray-400'}`}>
                          Antas ng Kahusayan
                        </span>
                      </div>
                      <div className="flex items-start gap-6">
                        <div className="flex-1">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Hinulaang (AI)</p>
                          <p className={`text-xl font-black ${pMeta?.color || 'text-gray-900'}`}>{dr.proficiency}</p>
                          <p className="mt-1 text-[11px] text-gray-500 leading-relaxed">
                            {dr.proficiency === ProficiencyLevel.NAGSISIMULA
                              ? 'Nangangailangan ng matinding suporta at gabay ng guro.'
                              : dr.proficiency === ProficiencyLevel.PAPAUNLAD
                                ? 'Maaaring sumulong sa tulong ng guro at pagsasanay.'
                                : 'Kaya niyang magtrabaho nang mag-isa sa mga gawaing angkop sa kanyang antas.'}
                          </p>
                        </div>
                        {teacherProficiency && teacherPMeta && (
                          <>
                            <div className="w-px self-stretch bg-gray-200" />
                            <div className="flex-1">
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Aktwal (Guro)</p>
                              <p className={`text-xl font-black ${teacherPMeta.color}`}>{teacherProficiency}</p>
                              <p className="mt-1 text-[11px] text-gray-500 leading-relaxed">
                                {teacherProficiency === ProficiencyLevel.NAGSISIMULA
                                  ? 'Nangangailangan ng matinding suporta at gabay ng guro.'
                                  : teacherProficiency === ProficiencyLevel.PAPAUNLAD
                                    ? 'Maaaring sumulong sa tulong ng guro at pagsasanay.'
                                    : 'Kaya niyang magtrabaho nang mag-isa sa mga gawaing angkop sa kanyang antas.'}
                              </p>
                            </div>
                          </>
                        )}
                        {!teacherProficiency && (
                          <div className="flex-1 flex items-center justify-center">
                            <p className="text-[10px] text-gray-400 italic">I-rate ang sanaysay para makita ang aktwal na antas.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Performance Metrics & Feedback */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6">
                  {/* Mga Sukatan ng Pagganap — temporarily hidden (metrics conflict with DepEd rubric labels) */}

                  {dr?.feedback && (
                    <div className="bg-teal-50 border border-teal-100 rounded-[24px] p-6">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-teal-600 mb-2 flex items-center gap-2">
                        <IoCheckmarkCircleOutline /> Feedback ng Guro {/* Teacher Feedback */}
                      </h4>
                      <p className="text-xs text-teal-900 leading-relaxed font-medium">
                        {dr.feedback}
                      </p>
                    </div>
                  )}
                </div>

                {/* Teacher Rubric Rating */}
                <div className="bg-white border border-gray-100 rounded-[24px] p-6 space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                    Marka ng Guro — DepEd Rubrik
                  </h4>

                  {/* Column headers */}
                  <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 items-center mb-1">
                    <span />
                    <span className="text-[9px] font-bold text-gray-400 text-center">Sistema</span>
                    <span className="text-[9px] font-bold text-gray-400 text-center">Guro</span>
                  </div>

                  {/* 5 dimension rows */}
                  {(['content', 'organization', 'languageVocab', 'grammar', 'mechanics'] as const).map(dim => {
                    const meta = DIMENSION_META[dim];
                    const rubricDim = dr?.rubricScore ? (dr.rubricScore as Record<string, any>)[dim] : undefined;
                    const sysScore: number = rubricDim?.score ?? 0;
                    const teacherScore = teacherDims[dim];
                    return (
                      <div key={dim} className="grid grid-cols-[1fr_auto_auto] gap-x-4 items-center">
                        <div>
                          <span className="text-xs font-semibold text-gray-700">{meta.labelFil}</span>
                          <span className="text-[9px] text-gray-400 ml-1">({meta.label})</span>
                        </div>
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4].map(n => (
                            <div
                              key={n}
                              className={`w-2 h-2 rounded-full ${n <= sysScore ? 'bg-teal-500' : 'bg-gray-200'}`}
                            />
                          ))}
                        </div>
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4].map(n => (
                            <button
                              key={n}
                              onClick={() => setTeacherDims(prev => ({ ...prev, [dim]: n }))}
                              className={`text-base transition-colors ${
                                n <= teacherScore ? 'text-amber-400' : 'text-gray-200 hover:text-amber-300'
                              }`}
                              aria-label={`${meta.labelFil} ${n}/4`}
                            >
                              {n <= teacherScore ? <IoStar /> : <IoStarOutline />}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  {/* Overall row */}
                  {(() => {
                    const dims = ['content', 'organization', 'languageVocab', 'grammar', 'mechanics'] as const;
                    const sysAvg = dr?.rubricScore
                      ? parseFloat(
                          (dims.reduce((s, d) => s + ((dr.rubricScore as Record<string, any>)[d]?.score ?? 0), 0) / 5).toFixed(1)
                        )
                      : null;
                    const teacherAvg = dims.every(d => teacherDims[d] > 0)
                      ? parseFloat((dims.reduce((s, d) => s + teacherDims[d], 0) / 5).toFixed(1))
                      : null;
                    return (
                      <div className="pt-2 border-t border-gray-100 grid grid-cols-[1fr_auto_auto] gap-x-4 items-center">
                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Kabuuan</span>
                        <span className="text-xs font-bold text-teal-600 text-center">
                          {sysAvg !== null ? `${sysAvg}/4` : '—'}
                        </span>
                        <span className="text-xs font-bold text-amber-500 text-center">
                          {teacherAvg !== null ? `${teacherAvg}/4` : '—'}
                        </span>
                      </div>
                    );
                  })()}

                  {/* Comment */}
                  <textarea
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs text-gray-700 leading-relaxed min-h-[70px] outline-none focus:ring-1 focus:ring-teal-500"
                    placeholder="Opsyonal na komento ng guro…"
                    value={teacherComment}
                    onChange={e => setTeacherComment(e.target.value)}
                  />

                  {/* Save */}
                  <div className="flex items-center justify-between gap-3">
                    <button
                      onClick={handleSaveTeacherEvaluation}
                      disabled={isSavingEvaluation}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                        isSavingEvaluation
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-teal-600 text-white hover:bg-teal-700'
                      }`}
                    >
                      {isSavingEvaluation ? 'Nag-iimbak…' : 'I-save ang Marka ng Guro'}
                    </button>
                    {evaluationMessage && (
                      <p className={`text-[10px] font-medium ${evaluationError ? 'text-red-500' : 'text-green-600'}`}>
                        {evaluationMessage}
                      </p>
                    )}
                  </div>
                </div>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
};
