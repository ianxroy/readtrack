import React, { useState, useEffect, useRef } from 'react';
import {
  IoPersonCircleOutline,
  IoStatsChartOutline,
  IoCheckmarkCircleOutline,
  IoBookOutline,
  IoStar,
  IoStarOutline,
} from 'react-icons/io5';

import { Student, Subject, StudentEssay, TeacherRubricScores } from './types';
import { ProficiencyLevel, DepEdRubricScore } from '../../types';
import { GrammarHighlightedText } from './GrammarHighlightedText';
import {
  getUILanguagePreference,
  resolveUILanguage,
  subscribeUILanguagePreferenceChange,
} from '../../services/uiSettings';
import { TeacherModalFrame, TeacherModalHeader, teacherModalTabClass } from '../ui/TeacherModal';

interface EssayViewerModalProps {
  student: Student;
  essay: StudentEssay;
  subject: Subject | null;
  onSaveEvaluation: (essayId: string, rubricScores: TeacherRubricScores, comment: string) => Promise<void>;
  onSaveEssayText: (essayId: string, essayText: string) => Promise<void>;
  onClose: () => void;
}

const proficiencyMeta = {
  [ProficiencyLevel.NAGSISIMULA]: { color: 'text-rose-600',   bg: 'bg-rose-50',   border: 'border-rose-100',   dot: 'bg-rose-500'   },
  [ProficiencyLevel.PAPAUNLAD]:   { color: 'text-amber-600',  bg: 'bg-amber-50',  border: 'border-amber-100',  dot: 'bg-amber-500'  },
  [ProficiencyLevel.MAHUSAY]:     { color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100', dot: 'bg-emerald-500' },
};

const DIMENSION_META = {
  content:       { labelFil: 'Nilalaman',        label: 'Content',      color: 'indigo' },
  organization:  { labelFil: 'Organisasyon',      label: 'Organization', color: 'teal'   },
  languageVocab: { labelFil: 'Wika/Talasalitaan', label: 'Language',     color: 'violet' },
  grammar:       { labelFil: 'Gramatika',         label: 'Grammar',      color: 'amber'  },
  mechanics:     { labelFil: 'Mekanika',          label: 'Mechanics',    color: 'rose'   },
} as const;

const SCORE_LABELS: Record<'english' | 'filipino', Record<number, string>> = {
  english:  { 1: 'Beginning', 2: 'Developing', 3: 'Approaching Proficiency', 4: 'Proficient' },
  filipino: { 1: 'Nagsisimula', 2: 'Papaunlad', 3: 'Papalapit sa Kahusayan', 4: 'Mahusay' },
};

const PROFICIENCY_LABELS: Record<'english' | 'filipino', Record<ProficiencyLevel, string>> = {
  english:  { [ProficiencyLevel.NAGSISIMULA]: 'Beginning', [ProficiencyLevel.PAPAUNLAD]: 'Developing', [ProficiencyLevel.MAHUSAY]: 'Proficient' },
  filipino: { [ProficiencyLevel.NAGSISIMULA]: 'Nagsisimula', [ProficiencyLevel.PAPAUNLAD]: 'Papaunlad', [ProficiencyLevel.MAHUSAY]: 'Mahusay' },
};

const PROFICIENCY_DESCRIPTION: Record<'english' | 'filipino', Record<ProficiencyLevel, string>> = {
  english: {
    [ProficiencyLevel.NAGSISIMULA]: 'Needs intensive teacher support and close guidance.',
    [ProficiencyLevel.PAPAUNLAD]:   'Can progress with guided practice and teacher support.',
    [ProficiencyLevel.MAHUSAY]:     'Can work independently on tasks aligned to the target level.',
  },
  filipino: {
    [ProficiencyLevel.NAGSISIMULA]: 'Nangangailangan ng matinding suporta at gabay ng guro.',
    [ProficiencyLevel.PAPAUNLAD]:   'Maaaring sumulong sa tulong ng guro at pagsasanay.',
    [ProficiencyLevel.MAHUSAY]:     'Kaya niyang magtrabaho nang mag-isa sa mga gawaing angkop sa kanyang antas.',
  },
};

function ScorePips({ score }: { score: number }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4].map(n => (
        <div key={n} className={`w-2.5 h-2.5 rounded-full transition-colors ${n <= score ? 'bg-indigo-400' : 'bg-slate-100'}`} />
      ))}
    </div>
  );
}

function DepEdRubricPanel({ rubric }: { rubric: DepEdRubricScore }) {
  const dims = (['content', 'organization', 'languageVocab', 'grammar', 'mechanics'] as const);
  const langLabel = rubric.language === 'filipino' ? 'Filipino' : 'English';
  const [displayLanguage, setDisplayLanguage] = useState<'english' | 'filipino'>(rubric.language);

  useEffect(() => { setDisplayLanguage(rubric.language); }, [rubric.language]);

  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm space-y-5">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
            <IoStatsChartOutline className="text-indigo-400" />
            DepEd Rubric · {rubric.gradeLevel} · {langLabel}
          </h4>
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            {(['filipino', 'english'] as const).map(lang => (
              <button
                key={lang}
                type="button"
                onClick={() => setDisplayLanguage(lang)}
                className={`px-2.5 py-0.5 text-[10px] font-semibold rounded-md transition-colors capitalize ${
                  displayLanguage === lang ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {lang}
              </button>
            ))}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Overall</div>
          <div className="text-2xl font-black text-indigo-600 tabular-nums leading-none">
            {rubric.overallScore.toFixed(1)}
            <span className="text-sm font-normal text-slate-400">/4</span>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {dims.map(dim => {
          const meta = DIMENSION_META[dim];
          const d = rubric[dim];
          const scoreLabel = SCORE_LABELS[displayLanguage][d.score] ?? '';
          return (
            <div key={dim}>
              <div className="flex items-center justify-between mb-1.5">
                <div>
                  <span className="text-xs font-bold text-slate-700">
                    {displayLanguage === 'filipino' ? meta.labelFil : meta.label}
                  </span>
                  <span className="text-[10px] text-slate-400 ml-1.5">
                    ({displayLanguage === 'filipino' ? meta.label : meta.labelFil})
                  </span>
                </div>
                <span className="text-[10px] font-bold text-slate-500">{d.score}/4 · {scoreLabel}</span>
              </div>
              <ScorePips score={d.score} />
              <p className="text-[10px] text-slate-500 mt-1.5 leading-relaxed">{d.rationale}</p>
            </div>
          );
        })}
      </div>

      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
        <p className="text-[11px] text-indigo-900 leading-relaxed font-medium">{rubric.overallFeedback}</p>
      </div>
    </div>
  );
}

function formatStudentName(value: string): string {
  return value?.trim() || 'Student';
}

export const EssayViewerModal: React.FC<EssayViewerModalProps> = ({
  student, essay, subject,
  onSaveEvaluation, onSaveEssayText, onClose,
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
  const [activeTab, setActiveTab] = useState<'compare' | 'original' | 'analysis'>('compare');
  const [editableText, setEditableText] = useState(essay.text);
  const [isSavingText, setIsSavingText] = useState(false);
  const [textMessage, setTextMessage] = useState<string | null>(null);
  const [textError, setTextError] = useState(false);
  const modalBodyRef = useRef<HTMLDivElement | null>(null);

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
    setActiveTab('compare');
    setEditableText(essay.text);
    setTextMessage(null);
    setTextError(false);
  }, [essay.id]);

  useEffect(() => {
    modalBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeTab]);

  const handleSaveEditedText = async () => {
    const next = editableText.trim();
    if (!next) { setTextError(true); setTextMessage(uiLanguage === 'english' ? 'Extracted text cannot be empty.' : 'Hindi maaaring walang laman ang extracted text.'); return; }
    setIsSavingText(true);
    setTextMessage(null);
    try {
      await onSaveEssayText(essay.id, next);
      setTextError(false);
      setTextMessage(uiLanguage === 'english' ? 'Extracted text saved.' : 'Nai-save ang extracted text.');
    } catch {
      setTextError(true);
      setTextMessage(uiLanguage === 'english' ? 'Could not save extracted text. Please try again.' : 'Hindi nai-save ang extracted text. Subukan muli.');
    } finally { setIsSavingText(false); }
  };

  const handleSaveTeacherEvaluation = async () => {
    const dims = ['content', 'organization', 'languageVocab', 'grammar', 'mechanics'] as const;
    const allSet = dims.every(d => teacherDims[d] >= 1 && teacherDims[d] <= 4);
    if (!allSet) { setEvaluationError(true); setEvaluationMessage(uiLanguage === 'english' ? 'Please rate all 5 dimensions before saving.' : 'I-rate ang lahat ng 5 dimensyon bago i-save.'); return; }
    setIsSavingEvaluation(true);
    setEvaluationMessage(null);
    try {
      const overall = parseFloat((dims.reduce((sum, d) => sum + teacherDims[d], 0) / 5).toFixed(2));
      const percentage = parseFloat(((overall / 4) * 100).toFixed(2));
      const transmuted = percentage >= 60
        ? parseFloat((((percentage - 60) / 40) * 25 + 75).toFixed(2))
        : parseFloat((((percentage) / 60) * 74).toFixed(2));
      const rubricScores: TeacherRubricScores = { ...teacherDims, overall, percentage, transmuted };
      await onSaveEvaluation(essay.id, rubricScores, teacherComment.trim());
      setEvaluationError(false);
      setEvaluationMessage(uiLanguage === 'english' ? 'Teacher rating saved.' : 'Nai-save ang marka ng guro.');
    } catch {
      setEvaluationError(true);
      setEvaluationMessage(uiLanguage === 'english' ? 'Could not save. Please try again.' : 'Hindi nai-save. Subukan muli.');
    } finally { setIsSavingEvaluation(false); }
  };

  const SAFE_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
  const allImages = essay.originalFiles?.length
    ? essay.originalFiles
    : essay.originalFile ? [essay.originalFile] : [];

  const dr = essay.diagnosisResult;
  const [uiLanguagePreference, setUiLanguagePreference] = useState(getUILanguagePreference());

  useEffect(() => {
    const unsubscribe = subscribeUILanguagePreferenceChange(() => {
      setUiLanguagePreference(getUILanguagePreference());
    });
    return unsubscribe;
  }, []);

  const automaticLanguage: 'english' | 'filipino' = subject?.language ?? dr?.rubricScore?.language ?? 'filipino';
  const uiLanguage: 'english' | 'filipino' = resolveUILanguage(uiLanguagePreference, automaticLanguage);

  const displayProficiency = (level: ProficiencyLevel) => PROFICIENCY_LABELS[uiLanguage][level] ?? level;
  const proficiencyDescription = (level: ProficiencyLevel) => PROFICIENCY_DESCRIPTION[uiLanguage][level] ?? '';

  const localized = {
    analyzedOn:        uiLanguage === 'english' ? 'Analyzed on' : 'Sinuri noong',
    predictedScore:    uiLanguage === 'english' ? 'Suggested Rating' : 'Mungkahing Marka',
    proficiencyLevel:  uiLanguage === 'english' ? 'Suggested Learning Level' : 'Mungkahing Antas ng Pagkatuto',
    predictedAi:       uiLanguage === 'english' ? 'Suggested by system' : 'Mungkahi ng sistema',
    actualTeacher:     uiLanguage === 'english' ? 'Teacher rating' : 'Marka ng guro',
    numericalSkill:    uiLanguage === 'english'
      ? 'Use this as a starting point, then confirm with your classroom judgment.'
      : 'Gamitin ito bilang panimulang gabay, saka kumpirmahin gamit ang iyong paghatol bilang guro.',
    teacherRubricScore:uiLanguage === 'english'
      ? 'Your saved classroom rating using the 5-dimension DepEd rubric.'
      : 'Iyong na-save na markang pangklase gamit ang 5-dimensyong rubrik ng DepEd.',
    rateToSeeScore:    uiLanguage === 'english' ? 'Complete your rating to show your final teacher score.' : 'Kumpletuhin ang iyong pagmamarka para makita ang pinal na marka ng guro.',
    rateToSeeLevel:    uiLanguage === 'english' ? 'Complete your rating to show your final level decision.' : 'Kumpletuhin ang iyong pagmamarka para makita ang pinal na antas.',
    compareFirstHint:  uiLanguage === 'english'
      ? 'Review the system suggestion and your rating side by side, then open details for full scoring.'
      : 'Ihambing ang mungkahi ng sistema at marka ng guro, pagkatapos buksan ang detalye para sa kumpletong pagmamarka.',
    proceedToRating:   uiLanguage === 'english' ? 'Open Rating Details' : 'Buksan ang Detalye ng Marka',
    backToCompare:     uiLanguage === 'english' ? 'Back to Summary' : 'Bumalik sa Buod',
    teacherFeedback:   uiLanguage === 'english' ? 'Teacher Feedback' : 'Feedback ng Guro',
    teacherRubric:     uiLanguage === 'english' ? 'Teacher Rating — DepEd Rubric' : 'Marka ng Guro — DepEd Rubrik',
    system:            uiLanguage === 'english' ? 'Suggested' : 'Mungkahi',
    teacher:           uiLanguage === 'english' ? 'Your Rating' : 'Iyong Marka',
    overall:           uiLanguage === 'english' ? 'Overall' : 'Kabuuan',
    optionalComment:   uiLanguage === 'english' ? 'Optional teacher comment...' : 'Opsyonal na komento ng guro...',
    saveTeacherRating: uiLanguage === 'english' ? 'Save Teacher Rating' : 'I-save ang Marka ng Guro',
    saving:            uiLanguage === 'english' ? 'Saving...' : 'Nag-iimbak…',
    ratingStepTitle:   uiLanguage === 'english' ? 'Step 2 · Complete your rating' : 'Hakbang 2 · Kumpletuhin ang iyong marka',
    tabs: {
      compare: uiLanguage === 'english' ? 'Compare' : 'Paghahambing',
      original: uiLanguage === 'english' ? 'Submission' : 'Isinumite',
      details: uiLanguage === 'english' ? 'Details' : 'Detalye',
    },
    originalSubmission: uiLanguage === 'english' ? 'Original Submission' : 'Orihinal na Isinumite',
    originalFile: uiLanguage === 'english' ? 'Original File' : 'Orihinal na File',
    imageLabel: uiLanguage === 'english' ? 'Image' : 'Larawan',
    noPreview: uiLanguage === 'english' ? 'No preview available for this file type.' : 'Walang preview para sa uri ng file na ito.',
    extractedText: uiLanguage === 'english' ? 'Extracted Text' : 'Na-extract na Teksto',
    saveText: uiLanguage === 'english' ? 'Save Text' : 'I-save ang Teksto',
    converted: uiLanguage === 'english' ? 'converted' : 'na-convert',
    analysisGuide: uiLanguage === 'english'
      ? 'Use the rubric below to score all five dimensions, then save the teacher rating.'
      : 'Gamitin ang rubrik sa ibaba para markahan ang limang dimensyon, pagkatapos ay i-save ang marka ng guro.',
    highlightedPreview: uiLanguage === 'english' ? 'Highlighted Preview' : 'Naka-highlight na Preview',
  };

  const pMeta = dr ? proficiencyMeta[dr.proficiency] : null;
  const teacherProficiency = essay.teacherRubricScores
    ? essay.teacherRubricScores.overall >= 3.5 ? ProficiencyLevel.MAHUSAY
      : essay.teacherRubricScores.overall >= 2.5 ? ProficiencyLevel.PAPAUNLAD
      : ProficiencyLevel.NAGSISIMULA
    : null;
  const teacherPMeta = teacherProficiency ? proficiencyMeta[teacherProficiency] : null;

  const TABS = [
    { key: 'compare', label: localized.tabs.compare },
    { key: 'original', label: localized.tabs.original },
    { key: 'analysis', label: localized.tabs.details },
  ] as const;

  const textareaClass = "w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-xs text-slate-700 leading-relaxed outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 transition-all resize-none";
  const analyzedAt = (essay.uploadedAt instanceof Date ? essay.uploadedAt : new Date(essay.uploadedAt as unknown as string)).toLocaleString();

  return (
    <TeacherModalFrame maxWidthClass="max-w-4xl">

        {/* Header */}
        <TeacherModalHeader
          onClose={onClose}
          closeLabel={uiLanguage === 'english' ? 'Close essay review' : 'Isara ang pagsusuri ng sanaysay'}
          title={essay.title}
          titleClassName="truncate"
          subtitle={`${localized.analyzedOn} ${analyzedAt}`}
          meta={(
            <>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold">
                <IoPersonCircleOutline className="text-[11px]" />
                {formatStudentName(student.name)}
              </div>
              {subject && (
                <div className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
                  {subject.name}
                </div>
              )}
              {dr && pMeta && (
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${pMeta.bg} ${pMeta.color} ${pMeta.border}`}>
                  {displayProficiency(dr.proficiency)}
                </span>
              )}
            </>
          )}
        />

        {/* Tab Bar */}
        <div className="flex border-b border-slate-100 px-4 flex-shrink-0">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={teacherModalTabClass(activeTab === tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div ref={modalBodyRef} className="flex-1 overflow-y-auto p-7 space-y-7">

          {/* Original Submission Tab */}
          {activeTab === 'original' && (
            <div>
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                <IoBookOutline /> {localized.originalSubmission}
              </h4>
              {allImages.length > 0 ? (
                <div className="flex gap-5">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                      {localized.originalFile}{allImages.length > 1 ? ` (${allImages.length})` : ''}
                    </p>
                    <div className="space-y-3">
                      {allImages.map((file, i) => {
                        const mime = SAFE_IMAGE_TYPES.has(file.mimeType) ? file.mimeType : null;
                        return (
                          <div key={i}>
                            {allImages.length > 1 && (
                              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">{localized.imageLabel} {i + 1}</div>
                            )}
                            {mime ? (
                              <img src={`data:${mime};base64,${file.base64}`} alt={`${localized.originalSubmission} ${i + 1}`} className="w-full rounded-xl border border-slate-100" />
                            ) : (
                              <div className="text-xs text-slate-400 italic p-4 bg-slate-50 rounded-xl border border-slate-100">
                                {localized.noPreview}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">{localized.extractedText}</p>
                    <textarea className={`${textareaClass} min-h-[280px]`} value={editableText} onChange={e => setEditableText(e.target.value)} />
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <button
                        onClick={handleSaveEditedText}
                        disabled={isSavingText || editableText.trim() === essay.text.trim()}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
                          isSavingText || editableText.trim() === essay.text.trim()
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            : 'bg-indigo-500 text-white hover:bg-indigo-600'
                        }`}
                      >
                        {isSavingText ? localized.saving : localized.saveText}
                      </button>
                      {textMessage && (
                        <p className={`text-[10px] font-medium ${textError ? 'text-rose-500' : 'text-emerald-600'}`}>{textMessage}</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <textarea className={`${textareaClass} min-h-[320px]`} value={editableText} onChange={e => setEditableText(e.target.value)} />
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <button
                      onClick={handleSaveEditedText}
                      disabled={isSavingText || editableText.trim() === essay.text.trim()}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
                        isSavingText || editableText.trim() === essay.text.trim()
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                          : 'bg-indigo-500 text-white hover:bg-indigo-600'
                      }`}
                    >
                      {isSavingText ? localized.saving : localized.saveText}
                    </button>
                    {textMessage && (
                      <p className={`text-[10px] font-medium ${textError ? 'text-rose-500' : 'text-emerald-600'}`}>{textMessage}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Compare Tab */}
          {activeTab === 'compare' && (
            <div className="space-y-5">
              {dr && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Score card */}
                  <div className="p-5 rounded-2xl border border-indigo-100 bg-indigo-50/60 md:col-span-2">
                    <div className="flex items-center gap-2 mb-3">
                      <IoStatsChartOutline className="text-indigo-500 text-sm" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600">{localized.predictedScore}</span>
                    </div>
                    <div className="flex items-start gap-6">
                      <div className="flex-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{localized.predictedAi}</p>
                        <p className="text-2xl font-black text-indigo-600 tabular-nums">
                          {dr.rubricScore ? `${dr.rubricScore.overallScore.toFixed(1)}/4` : `${dr.natScore}%`}
                        </p>
                        <p className="mt-1.5 text-[11px] text-slate-500 leading-relaxed">{localized.numericalSkill}</p>
                      </div>
                      {essay.teacherRubricScores ? (
                        <>
                          <div className="w-px self-stretch bg-indigo-100" />
                          <div className="flex-1">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{localized.actualTeacher}</p>
                            <p className="text-2xl font-black text-indigo-600 tabular-nums">
                              {essay.teacherRubricScores.overall.toFixed(1)}/4
                            </p>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              {essay.teacherRubricScores.percentage.toFixed(0)}%
                              {essay.teacherRubricScores.transmuted != null && ` · ${essay.teacherRubricScores.transmuted.toFixed(0)} ${localized.converted}`}
                            </p>
                            <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">{localized.teacherRubricScore}</p>
                          </div>
                        </>
                      ) : (
                        <div className="flex-1 flex items-center justify-center">
                          <p className="text-[10px] text-slate-400 italic">{localized.rateToSeeScore}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Proficiency card */}
                  <div className={`p-5 rounded-2xl border col-span-full ${pMeta?.border || 'border-slate-100'} ${pMeta?.bg || 'bg-slate-50'}`}>
                    <div className="flex items-center gap-2 mb-3">
                      <IoCheckmarkCircleOutline className={`text-sm ${pMeta?.color || 'text-slate-400'}`} />
                      <span className={`text-[10px] font-black uppercase tracking-widest ${pMeta?.color || 'text-slate-400'}`}>
                        {localized.proficiencyLevel}
                      </span>
                    </div>
                    <div className="flex items-start gap-6">
                      <div className="flex-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{localized.predictedAi}</p>
                        <p className={`text-xl font-black ${pMeta?.color || 'text-slate-900'}`}>{displayProficiency(dr.proficiency)}</p>
                        <p className="mt-1.5 text-[11px] text-slate-500 leading-relaxed">{proficiencyDescription(dr.proficiency)}</p>
                      </div>
                      {teacherProficiency && teacherPMeta ? (
                        <>
                          <div className="w-px self-stretch bg-slate-200" />
                          <div className="flex-1">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{localized.actualTeacher}</p>
                            <p className={`text-xl font-black ${teacherPMeta.color}`}>{displayProficiency(teacherProficiency)}</p>
                            <p className="mt-1.5 text-[11px] text-slate-500 leading-relaxed">{proficiencyDescription(teacherProficiency)}</p>
                          </div>
                        </>
                      ) : (
                        <div className="flex-1 flex items-center justify-center">
                          <p className="text-[10px] text-slate-400 italic">{localized.rateToSeeLevel}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 flex items-center justify-between gap-4">
                <p className="text-xs text-indigo-800 leading-relaxed">{localized.compareFirstHint}</p>
                <button
                  type="button"
                  onClick={() => setActiveTab('analysis')}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-500 text-white hover:bg-indigo-600 transition-colors shrink-0"
                >
                  {essay.teacherRubricScores ? localized.backToCompare : localized.proceedToRating}
                </button>
              </div>
            </div>
          )}

          {/* Analysis Tab */}
          {activeTab === 'analysis' && (
            <div className="space-y-7">
              <div className="rounded-2xl border border-teal-100 bg-teal-50/70 p-4 flex items-center justify-between gap-4">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-teal-700 mb-1">{localized.ratingStepTitle}</div>
                  <p className="text-xs text-teal-900 leading-relaxed">
                    {localized.analysisGuide}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('compare')}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-white text-teal-700 border border-teal-200 hover:bg-teal-50 transition-colors shrink-0"
                >
                  {localized.backToCompare}
                </button>
              </div>

              {/* Highlighted essay */}
              <div>
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">{localized.highlightedPreview}</h4>
                <div className="w-full rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                  <GrammarHighlightedText text={editableText} issues={dr?.issues ?? []} />
                </div>
              </div>

              {/* DepEd Rubric panel */}
              {dr?.rubricScore && <DepEdRubricPanel rubric={dr.rubricScore} />}

              {/* Feedback + Teacher Rubric */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-5">
                  {dr?.feedback && (
                    <div className="bg-teal-50 border border-teal-100 rounded-2xl p-5">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-teal-600 mb-2 flex items-center gap-2">
                        <IoCheckmarkCircleOutline /> {localized.teacherFeedback}
                      </h4>
                      <p className="text-xs text-teal-900 leading-relaxed font-medium">{dr.feedback}</p>
                    </div>
                  )}
                </div>

                {/* Teacher Rubric Rating */}
                <div className="bg-white border border-slate-100 rounded-2xl p-5 space-y-4 shadow-sm">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">{localized.teacherRubric}</h4>

                  <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 items-center">
                    <span />
                    <span className="text-[9px] font-bold text-slate-400 text-center">{localized.system}</span>
                    <span className="text-[9px] font-bold text-slate-400 text-center">{localized.teacher}</span>
                  </div>

                  {(['content', 'organization', 'languageVocab', 'grammar', 'mechanics'] as const).map(dim => {
                    const meta = DIMENSION_META[dim];
                    const rubricDim = dr?.rubricScore ? (dr.rubricScore as Record<string, any>)[dim] : undefined;
                    const sysScore: number = rubricDim?.score ?? 0;
                    const teacherScore = teacherDims[dim];
                    return (
                      <div key={dim} className="grid grid-cols-[1fr_auto_auto] gap-x-4 items-center py-1">
                        <div>
                          <span className="text-xs font-semibold text-slate-700">
                            {uiLanguage === 'english' ? meta.label : meta.labelFil}
                          </span>
                          <span className="text-[9px] text-slate-400 ml-1">
                            ({uiLanguage === 'english' ? meta.labelFil : meta.label})
                          </span>
                        </div>
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4].map(n => (
                            <div key={n} className={`w-2 h-2 rounded-full ${n <= sysScore ? 'bg-indigo-400' : 'bg-slate-100'}`} />
                          ))}
                        </div>
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4].map(n => (
                            <button
                              key={n}
                              onClick={() => setTeacherDims(prev => ({ ...prev, [dim]: n }))}
                              className={`text-base transition-colors ${n <= teacherScore ? 'text-amber-400' : 'text-slate-200 hover:text-amber-300'}`}
                              aria-label={`${uiLanguage === 'english' ? meta.label : meta.labelFil} ${n}/4`}
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
                      ? parseFloat((dims.reduce((s, d) => s + ((dr.rubricScore as Record<string, any>)[d]?.score ?? 0), 0) / 5).toFixed(1))
                      : null;
                    const teacherAvg = dims.every(d => teacherDims[d] > 0)
                      ? parseFloat((dims.reduce((s, d) => s + teacherDims[d], 0) / 5).toFixed(1))
                      : null;
                    return (
                      <div className="pt-2 border-t border-slate-100 grid grid-cols-[1fr_auto_auto] gap-x-4 items-center">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{localized.overall}</span>
                        <span className="text-xs font-bold text-indigo-500 text-center">{sysAvg !== null ? `${sysAvg}/4` : '—'}</span>
                        <span className="text-xs font-bold text-amber-500 text-center">{teacherAvg !== null ? `${teacherAvg}/4` : '—'}</span>
                      </div>
                    );
                  })()}

                  <textarea
                    className={`${textareaClass} min-h-[70px]`}
                    placeholder={localized.optionalComment}
                    value={teacherComment}
                    onChange={e => setTeacherComment(e.target.value)}
                  />

                  <div className="flex items-center justify-between gap-3">
                    <button
                      onClick={handleSaveTeacherEvaluation}
                      disabled={isSavingEvaluation}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                        isSavingEvaluation
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                          : 'bg-indigo-500 text-white hover:bg-indigo-600'
                      }`}
                    >
                      {isSavingEvaluation ? localized.saving : localized.saveTeacherRating}
                    </button>
                    {evaluationMessage && (
                      <p className={`text-[10px] font-medium ${evaluationError ? 'text-rose-500' : 'text-emerald-600'}`}>
                        {evaluationMessage}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
    </TeacherModalFrame>
  );
};
