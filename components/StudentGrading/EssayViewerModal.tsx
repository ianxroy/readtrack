import React, { useState, useEffect } from 'react';
import {
  IoPersonCircleOutline,
  IoCloseOutline,
  IoStatsChartOutline,
  IoCheckmarkCircleOutline,
  IoAlertCircleOutline,
  IoBookOutline,
  IoStar,
  IoStarOutline,
} from 'react-icons/io5';

import { Student, Subject, StudentEssay } from './types';
import {
  TextComplexityResult,
  StudentDiagnosisResult,
  ProficiencyLevel,
  ComplexityLevel,
} from '../../types';

interface EssayViewerModalProps {
  student: Student;
  essay: StudentEssay;
  subject: Subject | null;
  onSaveEvaluation: (essayId: string, rating: number, comment: string) => Promise<void>;
  onClose: () => void;
}

const proficiencyMeta = {
  [ProficiencyLevel.FRUSTRATION]: {
    color: 'text-red-600',
    bg: 'bg-red-50',
    border: 'border-red-100',
    dot: 'bg-red-500',
  },
  [ProficiencyLevel.INSTRUCTIONAL]: {
    color: 'text-orange-600',
    bg: 'bg-orange-50',
    border: 'border-orange-100',
    dot: 'bg-orange-500',
  },
  [ProficiencyLevel.INDEPENDENT]: {
    color: 'text-teal-600',
    bg: 'bg-teal-50',
    border: 'border-teal-100',
    dot: 'bg-teal-500',
  },
};

const complexityMeta = {
  [ComplexityLevel.LITERAL]: {
    color: 'text-green-600',
    bg: 'bg-green-50',
    border: 'border-green-100',
    dot: 'bg-green-500',
  },
  [ComplexityLevel.INFERENTIAL]: {
    color: 'text-orange-600',
    bg: 'bg-orange-50',
    border: 'border-orange-100',
    dot: 'bg-orange-500',
  },
  [ComplexityLevel.EVALUATIVE]: {
    color: 'text-red-600',
    bg: 'bg-red-50',
    border: 'border-red-100',
    dot: 'bg-red-500',
  },
};

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
  const [teacherRating, setTeacherRating] = useState(essay.teacherRating ?? 0);
  const [teacherComment, setTeacherComment] = useState(essay.teacherComment ?? '');
  const [isSavingEvaluation, setIsSavingEvaluation] = useState(false);
  const [evaluationMessage, setEvaluationMessage] = useState<string | null>(null);

  useEffect(() => {
    setTeacherRating(essay.teacherRating ?? 0);
    setTeacherComment(essay.teacherComment ?? '');
    setEvaluationMessage(null);
  }, [essay.id]);

  const handleSaveTeacherEvaluation = async () => {
    if (teacherRating < 1 || teacherRating > 5) {
      setEvaluationMessage('Please select a rating from 1 to 5 stars.');
      return;
    }
    setIsSavingEvaluation(true);
    setEvaluationMessage(null);
    try {
      await onSaveEvaluation(essay.id, teacherRating, teacherComment.trim());
      setEvaluationMessage('Teacher rating saved.');
    } catch {
      setEvaluationMessage('Failed to save rating.');
    } finally {
      setIsSavingEvaluation(false);
    }
  };

  const dr = essay.diagnosisResult;
  const cr = essay.complexityResult;
  const pMeta = dr ? proficiencyMeta[dr.proficiency] : null;
  const cMeta = cr ? complexityMeta[cr.level] : null;

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
              Sinuri noong {new Date(essay.uploadedAt).toLocaleString()} {/* Analyzed on */}
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

        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          {/* Scoring Grid */}
          {dr && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                {
                  label: 'Mungkahing Marka', // Suggested Score
                  value: `${dr.natScore}%`,
                  definition:
                    'Numerikong antas ng kasanayan batay sa kayamanan ng wika at istrukturang pagkakaisa.', // Numerical proficiency rating based on linguistic richness and structural cohesion.
                  icon: IoStatsChartOutline,
                  meta: {
                    color: 'text-blue-600',
                    bg: 'bg-blue-50',
                    border: 'border-blue-100',
                  },
                },
                {
                  label: 'Antas ng Kahusayan', // Proficiency
                  value: dr.proficiency,
                  definition:
                    dr.proficiency === ProficiencyLevel.FRUSTRATION
                      ? 'Nangangailangan ng matinding suporta at gabay ng guro.' // Needs intensive support and guided intervention.
                      : dr.proficiency === ProficiencyLevel.INSTRUCTIONAL
                        ? 'Maaaring sumulong sa tulong ng guro at pagsasanay.' // Can progress with teacher scaffolding and practice.
                        : 'Kaya niyang magtrabaho nang mag-isa sa mga gawaing angkop sa kanyang antas.', // Can work independently on grade-level tasks.
                  icon: IoCheckmarkCircleOutline,
                  meta: pMeta,
                },
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
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column: Metrics & Feedback */}
            <div className="space-y-6">
              {dr && (
                <div className="bg-white border border-gray-100 rounded-[24px] p-6 shadow-sm">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4 flex items-center gap-2">
                    <IoStatsChartOutline className="text-teal-500" />{' '}
                    Mga Sukatan ng Pagganap {/* Performance Metrics */}
                  </h4>
                  <div className="space-y-4">
                    {[
                      {
                        label: 'Katumpakan ng Gramatika', // Grammar Accuracy
                        val: dr.metrics.grammarAccuracy,
                      },
                      {
                        label: 'Kayamanan ng Talasalitaan', // Vocabulary Richness
                        val: dr.metrics.vocabularyRichness,
                      },
                      {
                        label: 'Kumplikasyon ng Pangungusap', // Sentence Complexity
                        val: dr.metrics.sentenceComplexity,
                      },
                      {
                        label: 'Istruktura at Pagkakaisa', // Structure & Cohesion
                        val: dr.metrics.structureCohesion,
                      },
                    ].map((m, i) => (
                      <div key={i}>
                        <div className="flex justify-between text-xs font-bold text-gray-700 mb-1.5">
                          <span>{m.label}</span>
                          <span className="text-teal-600">{m.val}%</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-teal-500 rounded-full"
                            style={{ width: `${m.val}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

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

            {/* Right Column: Original Submission */}
            <div className="flex flex-col">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3 ml-1 flex items-center gap-2">
                <IoBookOutline /> Orihinal na Isinumite {/* Original Submission */}
              </h4>
              {essay.originalFile ? (
                <div className="flex flex-col gap-3 flex-1">
                  {essay.originalFile.mimeType.startsWith('image/') && (
                    <img
                      src={`data:${essay.originalFile.mimeType};base64,${essay.originalFile.base64}`}
                      alt={essay.originalFile.name}
                      className="w-full rounded-2xl border border-gray-100 object-contain max-h-[200px]"
                    />
                  )}
                  <div className="flex-1 bg-gray-50 border border-gray-100 rounded-[24px] p-6 text-xs text-gray-700 leading-relaxed font-mono whitespace-pre-wrap max-h-[300px] overflow-y-auto">
                    {essay.text}
                  </div>
                </div>
              ) : (
                <div className="flex-1 bg-gray-50 border border-gray-100 rounded-[24px] p-6 text-xs text-gray-700 leading-relaxed font-mono whitespace-pre-wrap max-h-[400px] overflow-y-auto">
                  {essay.text}
                </div>
              )}
            </div>
          </div>

          {/* Teacher Rating */}
          <div className="bg-white border border-gray-100 rounded-[24px] p-6">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">
              Star Rating ng Guro {/* Teacher Star Rating */}
            </h4>
            <div className="flex items-center gap-2 mb-3">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setTeacherRating(star)}
                  className="text-2xl text-amber-400 hover:text-amber-500 transition-colors"
                  aria-label={`I-rate ng ${star} bituin`}
                >
                  {star <= teacherRating ? <IoStar /> : <IoStarOutline />}
                </button>
              ))}
              <span className="text-xs font-semibold text-gray-600 ml-1">
                {teacherRating ? `${teacherRating}/5` : 'Hindi pa na-rate'}
              </span>
            </div>

            <textarea
              className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs text-gray-700 leading-relaxed min-h-[90px] outline-none focus:ring-1 focus:ring-teal-500"
              placeholder="Opsyonal na komento ng guro..." // Optional teacher comment...
              value={teacherComment}
              onChange={(e) => setTeacherComment(e.target.value)}
            />

            <div className="mt-3 flex items-center justify-between gap-3">
              <button
                onClick={handleSaveTeacherEvaluation}
                disabled={isSavingEvaluation}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  isSavingEvaluation
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-teal-600 text-white hover:bg-teal-700'
                }`}
              >
                {isSavingEvaluation ? 'Nag-iimbak…' : 'I-save ang Rating ng Guro'} {/* Save Teacher Rating */}
              </button>
              {evaluationMessage && (
                <p className="text-[10px] text-gray-500 font-medium">{evaluationMessage}</p>
              )}
            </div>
          </div>

          {/* Grammar / Linguistic Issues */}
          {dr?.issues && dr.issues.length > 0 && (
            <div className="space-y-4">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 ml-1 flex items-center gap-2">
                <IoAlertCircleOutline className="text-red-500" />{' '}
                Mga Isyung Pangwika na Natagpuan ({dr.issues.length}) {/* Linguistic Issues Found */}
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {dr.issues.map((issue, i) => (
                  <div
                    key={i}
                    className="p-4 bg-white border border-gray-100 rounded-2xl shadow-sm flex items-start gap-3"
                  >
                    <div className="w-2 h-2 rounded-full bg-red-400 mt-1.5 shrink-0" />
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-black text-red-500 line-through opacity-50">
                          {issue.original}
                        </span>
                        <span className="text-[10px] font-black text-teal-600">
                          → {issue.suggestion}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-500 font-medium">
                        {issue.context}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
