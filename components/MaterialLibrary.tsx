import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
  IoCloudUploadOutline,
  IoSearchOutline,
  IoTrashOutline,
  IoCloseOutline,
  IoMenuOutline,
  IoBookOutline,
  IoChevronDownOutline,
  IoChevronUpOutline,
  IoInformationCircleOutline,
} from 'react-icons/io5';
import { LibraryMaterial, TextComplexityResult, ComplexityLevel, OriginalFile } from '../types';
import { classifyTextComplexityAPI, extractTextFromImageAPI, detectLanguageAPI, addTrainingSampleAPI, ingestReferenceAPI } from '../services/pythonService';

import { saveMaterialUpload, loadMaterialUploads, deleteMaterialUpload, saveMaterialTeacherVerification, loadMaterialSubjectCatalog, saveMaterialSubjectCatalog, updateMaterialSubject } from '../services/supabaseService';
import { useEffect } from 'react';
import { IoDocumentOutline, IoAddOutline } from 'react-icons/io5';

function normalizeSubjectName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function mergeSubjects(existing: string[], additions: string[]): string[] {
  const byLower = new Map<string, string>();
  [...existing, ...additions].forEach((s) => {
    const n = normalizeSubjectName(s);
    if (!n) return;
    if (!byLower.has(n.toLowerCase())) byLower.set(n.toLowerCase(), n);
  });
  return Array.from(byLower.values()).sort((a, b) => a.localeCompare(b));
}

function normalizeMaterialText(text: string): string {
  const normalized = text.replace(/\r\n?/g, '\n').trim();
  if (!normalized) return '';

  const paragraphs = normalized
    .split(/\n\s*\n+/)
    .map((paragraph) => paragraph.split('\n').map((line) => line.trim()).filter(Boolean));

  const rebuilt = paragraphs.map((lines) => {
    if (lines.length <= 1) return lines[0] || '';

    let merged = lines[0];
    for (let i = 1; i < lines.length; i += 1) {
      const prevLine = lines[i - 1];
      const currentLine = lines[i];

      const prevEndsSentence = /[.!?]["')\]]?$/.test(prevLine);
      const prevEndsHyphen = /-$/.test(prevLine);
      const currentIsList = /^[-•*]/.test(currentLine) || /^\d+[.)]\s/.test(currentLine);

      if (prevEndsHyphen) {
        merged = `${merged.slice(0, -1)}${currentLine}`;
      } else if (prevEndsSentence || currentIsList) {
        merged = `${merged}\n${currentLine}`;
      } else {
        merged = `${merged} ${currentLine}`;
      }
    }

    return merged;
  });

  return rebuilt.filter(Boolean).join('\n\n');
}

const COMPLEXITY_TO_PHIL_IRI: Record<ComplexityLevel, 'Independent' | 'Instructional' | 'Frustration'> = {
  [ComplexityLevel.LITERAL]:      'Independent',
  [ComplexityLevel.INFERENTIAL]:  'Instructional',
  [ComplexityLevel.EVALUATIVE]:   'Frustration',
};

const levelMeta = {
  [ComplexityLevel.LITERAL]: {
    bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200',
    dot: 'bg-green-500', badge: 'bg-green-50 text-green-700 border-green-200',
    label: 'Literal', desc: 'Easy — G7 Readable',
  },
  [ComplexityLevel.INFERENTIAL]: {
    bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200',
    dot: 'bg-orange-500', badge: 'bg-orange-50 text-orange-700 border-orange-200',
    label: 'Inferential', desc: 'Moderate — G7 Borderline',
  },
  [ComplexityLevel.EVALUATIVE]: {
    bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200',
    dot: 'bg-red-500', badge: 'bg-red-50 text-red-700 border-red-200',
    label: 'Evaluative', desc: 'Difficult — Above G7',
  },
};

type SortKey = 'newest' | 'oldest' | 'score_high' | 'score_low' | 'name';

function sortMaterials(items: LibraryMaterial[], key: SortKey): LibraryMaterial[] {
  const sorted = [...items];
  switch (key) {
    case 'newest': return sorted.sort((a, b) => +new Date(b.uploadedAt) - +new Date(a.uploadedAt));
    case 'oldest': return sorted.sort((a, b) => +new Date(a.uploadedAt) - +new Date(b.uploadedAt));
    case 'score_high': return sorted.sort((a, b) => b.complexityResult.score - a.complexityResult.score);
    case 'score_low': return sorted.sort((a, b) => a.complexityResult.score - b.complexityResult.score);
    case 'name': return sorted.sort((a, b) => a.name.localeCompare(b.name));
    default: return sorted;
  }
}

interface ReasoningResult {
  summary: string;
  tags: string[];
}

const REASONING_SUMMARIES: Record<ComplexityLevel, string> = {
  [ComplexityLevel.LITERAL]: 'This material uses simple words and short sentences that Grade 7 students can read on their own.',
  [ComplexityLevel.INFERENTIAL]: 'This material requires students to read between the lines — some teacher support may be needed.',
  [ComplexityLevel.EVALUATIVE]: 'This material uses complex ideas and language that are above Grade 7 level — scaffolding is recommended.',
};

const LEVEL_DESCRIPTIONS: Record<ComplexityLevel, string> = {
  [ComplexityLevel.LITERAL]: 'Easy for independent Grade 7 reading.',
  [ComplexityLevel.INFERENTIAL]: 'Moderate difficulty; may need teacher guidance.',
  [ComplexityLevel.EVALUATIVE]: 'Difficult and abstract; scaffolding recommended.',
};

const ADVANCED_METRIC_HELP: Record<string, string> = {
  'Complexity Score': 'Model score for how difficult the passage is. Higher values mean the text is more complex and usually needs more support.',
  'Readability Score': 'A readability measure used by the system. Higher values usually mean the passage is easier to read.',
  'Est. Reading Time': 'Estimated time for an average reader to finish the passage.',
  'Avg Sentence Len': 'Average number of words per sentence. Longer sentences often make text harder to read.',
  'Flesch-Kincaid Grade': 'Estimated U.S. grade level of the text. Higher grades mean harder reading.',
  'Gunning Fog Index': 'Estimated grade level based on sentence length and complex words. Higher values mean harder text.',
};

const PHIL_IRI_HELP = 'Phil-IRI stands for Philippine Informal Reading Inventory. In ReadTrack, it is used as a quick Grade 7 reading guide: Literal means easy and direct, Inferential means borderline and may need teacher support, and Evaluative means above Grade 7 and usually needs scaffolding.';

const REASONING_KEYWORDS: Record<ComplexityLevel, Array<{ pattern: RegExp; tag: string }>> = {
  [ComplexityLevel.LITERAL]: [
    { pattern: /short.{0,10}sentence/i, tag: 'Short sentences' },
    { pattern: /common.{0,10}word|simple.{0,10}word|basic.{0,10}word/i, tag: 'Common words' },
    { pattern: /direct|explicit/i, tag: 'Direct ideas' },
    { pattern: /low.{0,10}readab|easy.{0,10}read/i, tag: 'Easy to read' },
  ],
  // Spec-defined keywords + two intentional extras per level for better coverage:
  // 'May need support' and 'Needs scaffolding' extend the spec's list deliberately.
  [ComplexityLevel.INFERENTIAL]: [
    { pattern: /\bimpl(?:y|ied)\b|\binfer/i, tag: 'Implied meaning' },
    { pattern: /\bmoderate\b/i, tag: 'Moderate vocabulary' },
    { pattern: /context.{0,10}clue/i, tag: 'Context clues needed' },
    { pattern: /some.{0,10}support|teacher.{0,10}support/i, tag: 'May need support' },
  ],
  [ComplexityLevel.EVALUATIVE]: [
    { pattern: /\babstract\b/i, tag: 'Abstract concepts' },
    { pattern: /\bcomplex\b/i, tag: 'Complex structure' },
    { pattern: /advanced|difficult/i, tag: 'Advanced vocabulary' },
    { pattern: /scaffold/i, tag: 'Needs scaffolding' },
  ],
};

function parseReasoning(reasoning: string | undefined, level: ComplexityLevel): ReasoningResult {
  const summary = REASONING_SUMMARIES[level] ?? REASONING_SUMMARIES[ComplexityLevel.LITERAL];
  if (!reasoning || reasoning.trim().length === 0) {
    return { summary, tags: [] };
  }
  const keywords = REASONING_KEYWORDS[level] ?? [];
  const tags = keywords
    .filter(({ pattern }) => pattern.test(reasoning))
    .map(({ tag }) => tag)
    .slice(0, 4);
  return { summary, tags };
}

interface DetailModalProps {
  material: LibraryMaterial;
  onClose: () => void;
  onDelete: (id: string) => void;
  onUpdate: (updated: LibraryMaterial) => void;
  onVerify: (material: LibraryMaterial, level: ComplexityLevel, comment: string) => Promise<{ ok: boolean; message: string }>;
}

const SAFE_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const DOCX_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
]);

function base64ToBlobUrl(base64: string, mimeType: string): string {
  const bytes = atob(base64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return URL.createObjectURL(new Blob([arr], { type: mimeType }));
}

const DetailModal: React.FC<DetailModalProps> = ({ material, onClose, onDelete, onUpdate, onVerify }) => {
  const [editedText, setEditedText] = useState(material.text);
  const [isSavingText, setIsSavingText] = useState(false);
  const [textMessage, setTextMessage] = useState<string | null>(null);
  const [textError, setTextError] = useState(false);
  const [teacherLevel, setTeacherLevel] = useState<ComplexityLevel>(material.teacherVerifiedLevel ?? material.complexityResult.level);
  const [verificationComment, setVerificationComment] = useState(material.verificationComment ?? '');
  const [isSavingVerification, setIsSavingVerification] = useState(false);
  const [verifyMessage, setVerifyMessage] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState(false);
  const [activeTab, setActiveTab] = useState<'original' | 'analysis'>('original');
  const [activeMetricHelp, setActiveMetricHelp] = useState<string | null>(null);
  const meta = levelMeta[material.complexityResult.level] ?? levelMeta[ComplexityLevel.LITERAL];
  const cr = material.complexityResult;
  const { summary: reasoningSummary, tags: reasoningTags } = parseReasoning(
    cr.reasoning, material.complexityResult.level
  );

  const allImages = material.originalFiles?.length
    ? material.originalFiles
    : material.originalFile ? [material.originalFile] : [];
  const safeImageMime = material.originalFile?.mimeType && SAFE_IMAGE_TYPES.has(material.originalFile.mimeType)
    ? material.originalFile.mimeType
    : null;

  // Create a blob URL for PDF so browsers don't block data: URIs in iframes
  const pdfBlobUrl = useMemo(() => {
    if (material.originalFile?.mimeType === 'application/pdf' && material.originalFile.base64) {
      return base64ToBlobUrl(material.originalFile.base64, 'application/pdf');
    }
    return null;
  }, [material.originalFile]);

  useEffect(() => {
    return () => { if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl); };
  }, [pdfBlobUrl]);

  const handleSaveText = async () => {
    const next = editedText.trim();
    if (!next) {
      setTextError(true);
      setTextMessage('Text cannot be empty.');
      return;
    }
    setIsSavingText(true);
    setTextMessage(null);
    try {
      onUpdate({ ...material, text: next });
      setTextError(false);
      setTextMessage('Text saved.');
    } catch {
      setTextError(true);
      setTextMessage('Could not save. Try again.');
    } finally {
      setIsSavingText(false);
    }
  };

  const handleSaveVerification = async () => {
    setIsSavingVerification(true);
    setVerifyMessage(null);
    try {
      const res = await onVerify(material, teacherLevel, verificationComment.trim());
      setVerifyError(!res.ok);
      setVerifyMessage(res.message);
    } catch (e: any) {
      setVerifyError(true);
      setVerifyMessage(e?.message || 'Could not save verification.');
    } finally {
      setIsSavingVerification(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-[32px] shadow-2xl border border-white/20 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between p-8 border-b border-gray-50">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-3 mb-2">
              <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${meta.badge}`}>
                {meta.label}
              </span>
              {material.language && (
                <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${
                  material.language === 'eng'
                    ? 'bg-blue-50 text-blue-600 border-blue-100'
                    : 'bg-purple-50 text-purple-600 border-purple-100'
                }`}>
                  {material.language === 'eng' ? 'English' : 'Filipino'}
                </span>
              )}
            </div>
            <h2 className="text-2xl font-black text-gray-900 tracking-tight truncate">{material.name}</h2>
            <p className="text-sm text-gray-400 font-medium mt-1">
              Added {new Date(material.uploadedAt).toLocaleString()} &middot; {cr.wordCount || 0} words
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => { onDelete(material.id); onClose(); }}
              className="p-3 rounded-2xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"
            >
              <IoTrashOutline className="text-xl" />
            </button>
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

        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          {/* Original Submission Tab */}
          {activeTab === 'original' && (
            <div>
              <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4 flex items-center gap-2">
                <IoBookOutline /> Original File
              </h4>
              {(allImages.length > 0 || material.originalFile) ? (
                <div className="flex gap-4">
                  {/* Left: original file(s) */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase mb-2">
                      Original File{allImages.length > 1 ? `s (${allImages.length})` : ''}
                    </p>
                    {allImages.length > 1 ? (
                      <div className="space-y-3">
                        {allImages.map((img, i) => {
                          const mime = SAFE_IMAGE_TYPES.has(img.mimeType) ? img.mimeType : null;
                          return (
                            <div key={i}>
                              <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Image {i + 1}</div>
                              {mime ? (
                                <img src={`data:${mime};base64,${img.base64}`} alt={`Image ${i+1}`} className="w-full rounded-lg border border-gray-200" />
                              ) : (
                                <div className="text-xs text-gray-400 italic p-4 bg-gray-50 rounded-lg border border-gray-200">No preview available.</div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : safeImageMime ? (
                      <img
                        src={`data:${safeImageMime};base64,${material.originalFile!.base64}`}
                        alt="Original uploaded material"
                        className="w-full rounded-lg border border-gray-200"
                      />
                    ) : pdfBlobUrl ? (
                      <iframe
                        src={pdfBlobUrl}
                        className="w-full min-h-[400px] rounded-lg border border-gray-200"
                        title="Original PDF"
                      />
                    ) : DOCX_TYPES.has(material.originalFile!.mimeType) ? (
                      <div className="flex flex-col items-center justify-center gap-3 p-8 bg-blue-50 rounded-lg border border-blue-100 min-h-[200px]">
                        <IoDocumentOutline className="text-5xl text-blue-400" />
                        <div className="text-center">
                          <p className="text-sm font-bold text-blue-700">{material.originalFile!.name}</p>
                          <p className="text-[11px] text-blue-500 mt-1">Word Document — no browser preview available</p>
                          <p className="text-[10px] text-blue-400 mt-0.5">Extracted text is shown on the right</p>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-gray-400 italic p-4 bg-gray-50 rounded-lg border border-gray-200">
                        No preview available for this file type.
                      </div>
                    )}
                  </div>
                  {/* Right: extracted text */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase mb-2">Extracted Text</p>
                    <textarea
                      className="w-full min-h-[280px] bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs text-gray-700 leading-relaxed outline-none focus:ring-1 focus:ring-teal-500"
                      value={editedText}
                      onChange={e => setEditedText(e.target.value)}
                    />
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <button
                        onClick={handleSaveText}
                        disabled={isSavingText || editedText.trim() === material.text.trim()}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
                          isSavingText || editedText.trim() === material.text.trim()
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-teal-600 text-white hover:bg-teal-700'
                        }`}
                      >
                        {isSavingText ? 'Saving…' : 'Save Text'}
                      </button>
                      {textMessage && (
                        <p className={`text-[10px] font-medium ${textError ? 'text-red-500' : 'text-green-600'}`}>
                          {textMessage}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase mb-2">Extracted Text</p>
                  <textarea
                    className="w-full min-h-[320px] bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs text-gray-700 leading-relaxed outline-none focus:ring-1 focus:ring-teal-500"
                    value={editedText}
                    onChange={e => setEditedText(e.target.value)}
                  />
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <button
                      onClick={handleSaveText}
                      disabled={isSavingText || editedText.trim() === material.text.trim()}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
                        isSavingText || editedText.trim() === material.text.trim()
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-teal-600 text-white hover:bg-teal-700'
                      }`}
                    >
                      {isSavingText ? 'Saving…' : 'Save Text'}
                    </button>
                    {textMessage && (
                      <p className={`text-[10px] font-medium ${textError ? 'text-red-500' : 'text-green-600'}`}>
                        {textMessage}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Analysis Tab */}
          {activeTab === 'analysis' && (
            <div className="space-y-6">
              {/* Teacher verification */}
              <div className="rounded-xl border border-teal-100 bg-teal-50/60 p-4">
                <div className="text-[10px] font-bold uppercase tracking-widest text-teal-700 mb-2">
                  Teacher Verification (Improves Model Reliability)
                </div>
                <div className="flex flex-wrap gap-2 mb-2">
                  {(Object.values(ComplexityLevel) as ComplexityLevel[]).map(level => (
                    <button
                      key={level}
                      onClick={() => setTeacherLevel(level)}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-colors ${
                        teacherLevel === level
                          ? 'bg-teal-600 text-white border-teal-600'
                          : 'bg-white text-teal-700 border-teal-200 hover:border-teal-400'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-teal-700 mb-2">{LEVEL_DESCRIPTIONS[teacherLevel]}</p>
                <textarea
                  value={verificationComment}
                  onChange={e => setVerificationComment(e.target.value)}
                  placeholder="Optional note on why this level is correct"
                  className="w-full min-h-[70px] bg-white border border-teal-100 rounded-lg p-2 text-xs text-gray-700 outline-none focus:ring-1 focus:ring-teal-400"
                />
                <div className="mt-2 flex items-center justify-between gap-3">
                  <button
                    onClick={handleSaveVerification}
                    disabled={isSavingVerification}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
                      isSavingVerification
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-teal-600 text-white hover:bg-teal-700'
                    }`}
                  >
                    {isSavingVerification ? 'Saving…' : 'Save & Improve Model'}
                  </button>
                  {verifyMessage && (
                    <p className={`text-[10px] font-medium ${verifyError ? 'text-red-500' : 'text-green-700'}`}>
                      {verifyMessage}
                    </p>
                  )}
                </div>
              </div>

              {/* Advanced info accordion */}
              <details className={`rounded-xl border p-4 ${meta.bg} ${meta.border}`}>
                <summary className={`flex items-center justify-between cursor-pointer list-none ${meta.text}`}>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest opacity-70">Advanced Info</div>
                    <p className="text-[11px] mt-0.5 opacity-80">Click the i beside any label to see what it means.</p>
                  </div>
                  <IoChevronDownOutline className="text-sm shrink-0" />
                </summary>

                <div className="mt-4 space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                    {[
                      { label: 'Complexity Score', value: cr.score ?? 'N/A' },
                      { label: 'Readability Score', value: cr.readabilityScore ?? 'N/A' },
                      { label: 'Est. Reading Time', value: `${cr.estimatedReadingTime ?? '?'} min` },
                      { label: 'Avg Sentence Len', value: `${cr.avgSentenceLength ?? '?'} words` },
                    ].map(({ label, value }) => (
                      <div key={label} className="group relative rounded-lg bg-white/60 border border-white/60 p-2.5">
                        <button
                          type="button"
                          onClick={() => setActiveMetricHelp(activeMetricHelp === label ? null : label)}
                          className={`mx-auto inline-flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-wide mb-0.5 ${meta.text} opacity-75`}
                          aria-expanded={activeMetricHelp === label}
                          aria-controls={`metric-help-${label.replace(/\s+/g, '-').toLowerCase()}`}
                        >
                          <span>{label}</span>
                          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-white/80 border border-current/10">
                            <IoInformationCircleOutline className="text-[11px] opacity-70" />
                          </span>
                        </button>
                        <div className={`text-lg font-bold ${meta.text}`}>{value}</div>
                        {activeMetricHelp === label && (
                          <p id={`metric-help-${label.replace(/\s+/g, '-').toLowerCase()}`} className="mt-2 text-[10px] leading-relaxed text-gray-600">
                            {ADVANCED_METRIC_HELP[label]}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  {cr.readability && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {cr.readability.flesch_kincaid !== undefined && (
                        <div className="bg-white/60 border border-white/60 rounded-xl p-3 text-center">
                          <button
                            type="button"
                            onClick={() => setActiveMetricHelp(activeMetricHelp === 'Flesch-Kincaid Grade' ? null : 'Flesch-Kincaid Grade')}
                            className="mx-auto inline-flex items-center gap-1 text-[10px] text-gray-500 font-semibold uppercase tracking-wider mb-0.5"
                            aria-expanded={activeMetricHelp === 'Flesch-Kincaid Grade'}
                            aria-controls="metric-help-flesch-kincaid-grade"
                          >
                            <span>Flesch-Kincaid Grade</span>
                            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-white/80 border border-gray-200">
                              <IoInformationCircleOutline className="text-[11px]" />
                            </span>
                          </button>
                          <div className="text-xl font-bold text-teal-600">{cr.readability.flesch_kincaid}</div>
                          {activeMetricHelp === 'Flesch-Kincaid Grade' && (
                            <p id="metric-help-flesch-kincaid-grade" className="mt-2 text-[10px] leading-relaxed text-gray-600">
                              {ADVANCED_METRIC_HELP['Flesch-Kincaid Grade']}
                            </p>
                          )}
                        </div>
                      )}
                      {cr.readability.gunning_fog !== undefined && (
                        <div className="bg-white/60 border border-white/60 rounded-xl p-3 text-center">
                          <button
                            type="button"
                            onClick={() => setActiveMetricHelp(activeMetricHelp === 'Gunning Fog Index' ? null : 'Gunning Fog Index')}
                            className="mx-auto inline-flex items-center gap-1 text-[10px] text-gray-500 font-semibold uppercase tracking-wider mb-0.5"
                            aria-expanded={activeMetricHelp === 'Gunning Fog Index'}
                            aria-controls="metric-help-gunning-fog-index"
                          >
                            <span>Gunning Fog Index</span>
                            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-white/80 border border-gray-200">
                              <IoInformationCircleOutline className="text-[11px]" />
                            </span>
                          </button>
                          <div className="text-xl font-bold text-teal-600">{cr.readability.gunning_fog}</div>
                          {activeMetricHelp === 'Gunning Fog Index' && (
                            <p id="metric-help-gunning-fog-index" className="mt-2 text-[10px] leading-relaxed text-gray-600">
                              {ADVANCED_METRIC_HELP['Gunning Fog Index']}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </details>

              {/* Reasoning */}
              <div className={`rounded-xl border p-4 ${meta.bg} ${meta.border}`}>
                <div className={`text-[10px] font-bold uppercase tracking-widest mb-1.5 ${meta.text}`}>
                  Why is this {meta.label}?
                </div>
                <p className={`text-xs leading-relaxed mb-2 ${meta.text}`}>{reasoningSummary}</p>
                {reasoningTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {reasoningTags.map(tag => (
                      <span
                        key={tag}
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/60 ${meta.text}`}
                      >
                        ✓ {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface UploadVerificationModalProps {
  material: LibraryMaterial;
  materialName: string;
  onChangeName: (value: string) => void;
  onCancel: () => void;
  onContinue: () => void;
}

const UploadCompareModal: React.FC<UploadVerificationModalProps> = ({
  material,
  materialName,
  onChangeName,
  onCancel,
  onContinue,
}) => {
  const safeImageMime = material.originalFile?.mimeType && SAFE_IMAGE_TYPES.has(material.originalFile.mimeType)
    ? material.originalFile.mimeType
    : null;

  const pdfBlobUrl = useMemo(() => {
    if (material.originalFile?.mimeType === 'application/pdf' && material.originalFile.base64) {
      return base64ToBlobUrl(material.originalFile.base64, 'application/pdf');
    }
    return null;
  }, [material.originalFile]);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-gray-100">
          <div className="flex-1 min-w-0 pr-3">
            <h3 className="text-lg font-black text-gray-900">Confirm Material Level</h3>
            <p className="text-xs text-gray-500 mt-1">
              Model predicted: <span className="font-semibold">{material.complexityResult.level}</span>
            </p>
            <div className="mt-3">
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Material Title</label>
              <input
                type="text"
                value={materialName}
                onChange={(e) => onChangeName(e.target.value)}
                placeholder="Enter material title"
                className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-teal-300"
              />
            </div>
          </div>
          <button onClick={onCancel} className="p-2 rounded-full hover:bg-gray-100 text-gray-400 shrink-0">
            <IoCloseOutline className="text-lg" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Original File</p>
              {material.originalFile ? (
                safeImageMime ? (
                  <img
                    src={`data:${safeImageMime};base64,${material.originalFile.base64}`}
                    alt="Original uploaded material"
                    className="w-full rounded-lg border border-gray-200"
                  />
                ) : pdfBlobUrl ? (
                  <iframe
                    src={pdfBlobUrl}
                    className="w-full min-h-[420px] rounded-lg border border-gray-200"
                    title="Original PDF"
                  />
                ) : DOCX_TYPES.has(material.originalFile.mimeType) ? (
                  <div className="flex flex-col items-center justify-center gap-3 p-8 bg-blue-50 rounded-lg border border-blue-100 min-h-[260px]">
                    <IoDocumentOutline className="text-5xl text-blue-400" />
                    <div className="text-center">
                      <p className="text-sm font-bold text-blue-700">{material.originalFile.name}</p>
                      <p className="text-[11px] text-blue-500 mt-1">Word Document — no browser preview available</p>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-gray-400 italic p-4 bg-gray-50 rounded-lg border border-gray-200 min-h-[260px] flex items-center justify-center">
                    No preview available for this file type.
                  </div>
                )
              ) : (
                <div className="text-xs text-gray-400 italic p-4 bg-gray-50 rounded-lg border border-gray-200 min-h-[260px] flex items-center justify-center">
                  No original file attached.
                </div>
              )}
            </div>

            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Extracted Text</p>
              <textarea
                value={material.text}
                readOnly
                className="w-full min-h-[420px] bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-gray-700 leading-relaxed outline-none resize-none"
              />
            </div>
          </div>
        </div>

        <div className="px-6 pb-6 pt-3 flex items-center justify-end gap-2 border-t border-gray-100">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-xs font-semibold rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={onContinue}
            className="px-5 py-2 text-xs font-black rounded-xl bg-teal-600 text-white hover:bg-teal-700 transition-colors"
          >
            Save & Continue
          </button>
        </div>
      </div>
    </div>
  );
};

interface UploadTeacherVerificationModalProps {
  material: LibraryMaterial;
  selectedLevel: ComplexityLevel;
  comment: string;
  saving: boolean;
  onSelectLevel: (level: ComplexityLevel) => void;
  onChangeComment: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

const UploadVerificationModal: React.FC<UploadTeacherVerificationModalProps> = ({
  material,
  selectedLevel,
  comment,
  saving,
  onSelectLevel,
  onChangeComment,
  onCancel,
  onConfirm,
}) => {
  const predicted = material.complexityResult.level;
  const isManualChoice = selectedLevel !== predicted;
  const [decisionMode, setDecisionMode] = useState<'confirm' | 'manual'>('confirm');
  const [previewOpen, setPreviewOpen] = useState(false);
  const predMeta = levelMeta[predicted] ?? levelMeta[ComplexityLevel.LITERAL];
  const selMeta = levelMeta[selectedLevel] ?? levelMeta[ComplexityLevel.LITERAL];
  const { summary: reasoningSummary } = parseReasoning(material.complexityResult.reasoning, predicted);

  const safeImageMime = material.originalFile?.mimeType && SAFE_IMAGE_TYPES.has(material.originalFile.mimeType)
    ? material.originalFile.mimeType
    : null;

  const pdfBlobUrl = useMemo(() => {
    if (material.originalFile?.mimeType === 'application/pdf' && material.originalFile.base64) {
      return base64ToBlobUrl(material.originalFile.base64, 'application/pdf');
    }
    return null;
  }, [material.originalFile]);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-gray-100">
          <div className="flex-1 min-w-0 pr-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">New Material</p>
            <h3 className="text-base font-black text-gray-900 truncate">{material.name}</h3>
            {material.language && (
              <span className={`inline-block mt-1 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${
                material.language === 'eng'
                  ? 'bg-blue-50 text-blue-600 border-blue-100'
                  : 'bg-purple-50 text-purple-600 border-purple-100'
              }`}>
                {material.language === 'eng' ? 'English' : 'Filipino'}
              </span>
            )}
          </div>
          <button onClick={onCancel} className="p-2 rounded-full hover:bg-gray-100 text-gray-400 shrink-0">
            <IoCloseOutline className="text-lg" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {/* Model Recommendation Card */}
          <div className={`rounded-2xl border-2 p-4 ${predMeta.bg} ${predMeta.border}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${predMeta.text} opacity-70`}>
                  Model Recommendation
                </p>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${predMeta.dot}`} />
                  <span className={`text-xl font-black ${predMeta.text}`}>{predicted}</span>
                </div>
                <p className={`text-[11px] leading-relaxed ${predMeta.text} opacity-80`}>{reasoningSummary}</p>
              </div>
            </div>
          </div>

          {/* Teacher decision */}
          <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 space-y-3">
            <div>
              <p className="text-sm font-bold text-gray-800">Is this recommendation correct?</p>
              <p className="text-[11px] text-gray-500 mt-1">Keep the model suggestion, or choose a different level manually.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                onClick={() => {
                  setDecisionMode('confirm');
                  onSelectLevel(predicted);
                }}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 font-bold text-sm transition-all ${
                  decisionMode === 'confirm'
                    ? `${predMeta.bg} ${predMeta.border} ${predMeta.text}`
                    : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                Keep {predicted}
              </button>
              <button
                onClick={() => setDecisionMode('manual')}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 font-bold text-sm transition-all ${
                  decisionMode === 'manual'
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                Choose manually
              </button>
            </div>

            {decisionMode === 'manual' && (
              <div className="pt-1 space-y-2 animate-in slide-in-from-top-2 duration-150">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Select the manual level:</p>
                <select
                  value={selectedLevel}
                  onChange={(e) => onSelectLevel(e.target.value as ComplexityLevel)}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-indigo-400"
                >
                  {(Object.values(ComplexityLevel) as ComplexityLevel[]).map(level => (
                    <option key={level} value={level}>{level}</option>
                  ))}
                </select>
                <p className={`text-[11px] font-medium ${selMeta.text}`}>{LEVEL_DESCRIPTIONS[selectedLevel]}</p>
              </div>
            )}
          </div>

          {/* Final level indicator when manually adjusted */}
          {isManualChoice && (
            <div className={`rounded-xl border px-4 py-2.5 flex items-center gap-2 ${selMeta.bg} ${selMeta.border}`}>
              <span className={`w-2 h-2 rounded-full shrink-0 ${selMeta.dot}`} />
              <span className={`text-[11px] font-bold ${selMeta.text}`}>
                Will be saved as: <span className="font-black">{selectedLevel}</span>
              </span>
            </div>
          )}

          {/* Optional comment */}
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">
              Note <span className="normal-case font-normal">(optional)</span>
            </p>
            <textarea
              value={comment}
              onChange={e => onChangeComment(e.target.value)}
              placeholder="e.g. Grade 7 Section Rizal uses this for inferential practice"
              className="w-full min-h-[64px] bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-gray-700 outline-none focus:ring-1 focus:ring-teal-400 resize-none"
            />
          </div>

          {/* Collapsible text preview */}
          <div>
            <button
              onClick={() => setPreviewOpen(v => !v)}
              className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-400 hover:text-gray-600 uppercase tracking-widest"
            >
              {previewOpen ? <IoChevronUpOutline /> : <IoChevronDownOutline />}
              {previewOpen ? 'Hide' : 'Show'} extracted text ({material.text.split(/\s+/).length} words)
            </button>
            {previewOpen && (
              <textarea
                value={material.text}
                readOnly
                className="mt-2 w-full min-h-[160px] max-h-[240px] bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs text-gray-600 leading-relaxed outline-none resize-none"
              />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 pt-3 flex items-center justify-end gap-2 border-t border-gray-100">
          <button
            onClick={onCancel}
            disabled={saving}
            className="px-4 py-2 text-xs font-semibold rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={saving}
            className={`px-5 py-2 text-xs font-black rounded-xl transition-colors ${
              saving
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : isManualChoice
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                  : 'bg-teal-600 text-white hover:bg-teal-700'
            }`}
          >
            {saving ? 'Saving…' : isManualChoice ? `Save as ${selectedLevel}` : `Keep ${predicted} & Save`}
          </button>
        </div>
      </div>
    </div>
  );
};

interface MaterialLibraryProps {
  onMenuClick?: () => void;
  onDataChanged?: () => void;
}

export const MaterialLibrary: React.FC<MaterialLibraryProps> = ({ onMenuClick, onDataChanged }) => {
  const [materials, setMaterials] = useState<LibraryMaterial[]>([]);
  const [materialsLoading, setMaterialsLoading] = useState(true);
  const [filter, setFilter] = useState<ComplexityLevel | 'all'>('all');
  const [sort, setSort] = useState<SortKey>('newest');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<LibraryMaterial | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [stagedImages, setStagedImages] = useState<OriginalFile[]>([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadFileName, setUploadFileName] = useState<string>('');
  const [pendingUploadMaterial, setPendingUploadMaterial] = useState<LibraryMaterial | null>(null);
  const [showUploadCompareModal, setShowUploadCompareModal] = useState(false);
  const [showUploadVerifyModal, setShowUploadVerifyModal] = useState(false);
  const [uploadModalLevel, setUploadModalLevel] = useState<ComplexityLevel>(ComplexityLevel.LITERAL);
  const [uploadModalComment, setUploadModalComment] = useState('');
  const [savingUploadDecision, setSavingUploadDecision] = useState(false);
  const [showPhilIriHelp, setShowPhilIriHelp] = useState(false);
  const [langFilter, setLangFilter] = useState<'all' | 'eng' | 'fil'>('all');
  const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);
  const [subjectFilter, setSubjectFilter] = useState<'all' | string>('all');
  const [uploadModalSubject, setUploadModalSubject] = useState('');
  const [newSubjectName, setNewSubjectName] = useState('');
  const [showAddSubjectPanel, setShowAddSubjectPanel] = useState(false);
  const [subjectPanelError, setSubjectPanelError] = useState<string | null>(null);
  const [savingSubjectPanel, setSavingSubjectPanel] = useState(false);
  const dragCount = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);



  useEffect(() => {
    let cancelled = false;
    Promise.all([loadMaterialUploads(), loadMaterialSubjectCatalog()]).then(async ([materialsRes, subjectsRes]) => {
      if (!cancelled) {
        const { data, error } = materialsRes;
        if (!error && data.length > 0) {
          let langs: Array<'eng' | 'fil'>;
          try {
            langs = await Promise.all(data.map(m => detectLanguageAPI(m.text)));
          } catch {
            langs = data.map(() => 'fil' as const);
          }
          const withLangs = data.map((m, i) => ({ ...m, language: langs[i] }));
          setMaterials(withLangs);
          // Collect subjects from materials themselves + catalog
          const fromMaterials = (data as LibraryMaterial[]).map(m => (m.subject || '').trim()).filter(Boolean);
          const fromCatalog = (subjectsRes.error ? [] : subjectsRes.data).map((s: string) => s.trim()).filter(Boolean);
          setAvailableSubjects(mergeSubjects([], [...fromMaterials, ...fromCatalog]));
        } else if (!error) {
          setMaterials(data);
          const fromCatalog = (subjectsRes.error ? [] : subjectsRes.data).map((s: string) => s.trim()).filter(Boolean);
          setAvailableSubjects(mergeSubjects([], fromCatalog));
        }
        setMaterialsLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  const refreshMaterials = async () => {
    const [{ data, error }, subjectsRes] = await Promise.all([loadMaterialUploads(), loadMaterialSubjectCatalog()]);
    if (error) return;
    if (data.length > 0) {
      let langs: Array<'eng' | 'fil'>;
      try {
        langs = await Promise.all(data.map(m => detectLanguageAPI(m.text)));
      } catch {
        langs = data.map(() => 'fil' as const);
      }
      setMaterials(data.map((m, i) => ({ ...m, language: langs[i] })));
      const fromMaterials = (data as LibraryMaterial[]).map(m => (m.subject || '').trim()).filter(Boolean);
      const fromCatalog = (subjectsRes.error ? [] : subjectsRes.data).map((s: string) => s.trim()).filter(Boolean);
      setAvailableSubjects(mergeSubjects([], [...fromMaterials, ...fromCatalog]));
    } else {
      setMaterials(data);
      const fromCatalog = (subjectsRes.error ? [] : subjectsRes.data).map((s: string) => s.trim()).filter(Boolean);
      setAvailableSubjects(mergeSubjects([], fromCatalog));
    }
  };

  const handleAddSubject = async () => {
    const normalized = normalizeSubjectName(newSubjectName);
    if (!normalized) { setSubjectPanelError('Subject name is required.'); return; }
    if (availableSubjects.some(s => s.toLowerCase() === normalized.toLowerCase())) {
      setSubjectPanelError('Subject already exists.'); return;
    }
    setSavingSubjectPanel(true);
    setSubjectPanelError(null);
    const next = mergeSubjects(availableSubjects, [normalized]);
    const { error } = await saveMaterialSubjectCatalog(next);
    setSavingSubjectPanel(false);
    if (error) { setSubjectPanelError(`Could not save: ${error}`); return; }
    setAvailableSubjects(next);
    setNewSubjectName('');
    setShowAddSubjectPanel(false);
  };

  const handleUpdateSubject = async (id: string, subject: string | null) => {
    const normalized = subject ? normalizeSubjectName(subject) : null;
    await updateMaterialSubject(id, normalized);
    setMaterials(prev => prev.map(m => m.id === id ? { ...m, subject: normalized ?? undefined } : m));
    if (normalized) setAvailableSubjects(prev => mergeSubjects(prev, [normalized]));
  };

  const persist = (updated: LibraryMaterial[]) => {
    setMaterials(updated);
  };

  const handleUpdate = (updated: LibraryMaterial) => {
    setMaterials(materials.map(m => m.id === updated.id ? updated : m));
  };

  const handleDelete = async (id: string) => {
    setMaterials((prev) => prev.filter(m => m.id !== id));
    const { error } = await deleteMaterialUpload(id);
    if (error) console.error('Delete material failed:', error);
    await refreshMaterials();
  };

  const handleVerifyMaterial = async (material: LibraryMaterial, level: ComplexityLevel, comment: string) => {
    const saveRes = await saveMaterialTeacherVerification(material.id, { level: COMPLEXITY_TO_PHIL_IRI[level], comment }, material.complexityResult);
    if (saveRes.error) {
      return { ok: false, message: `Could not save verification: ${saveRes.error}` };
    }

    let message = 'Teacher verification saved.';
    let ok = true;
    try {
      const trainRes = await addTrainingSampleAPI(material.text, COMPLEXITY_TO_PHIL_IRI[level]);
      message = trainRes.message || message;
      if (trainRes.status !== 'ok') ok = false;
    } catch (e: any) {
      ok = false;
      message = `Verification saved, but model training failed: ${e?.message || 'unknown error'}`;
    }

    const updated: LibraryMaterial = {
      ...material,
      teacherVerifiedLevel: level,
      teacherVerifiedAt: new Date().toISOString(),
      verificationComment: comment || undefined,
      isVerified: true,
      complexityResult: {
        ...material.complexityResult,
        level,
      },
    };

    setMaterials(prev => prev.map(m => (m.id === material.id ? updated : m)));
    await refreshMaterials();
    onDataChanged?.();
    return { ok, message };
  };

  const handleFinalizePendingUpload = async () => {
    if (!pendingUploadMaterial) return;

    setSavingUploadDecision(true);
    const material: LibraryMaterial = {
      ...pendingUploadMaterial,
      teacherVerifiedLevel: uploadModalLevel,
      teacherVerifiedAt: new Date().toISOString(),
      verificationComment: uploadModalComment.trim() || undefined,
      isVerified: true,
      complexityResult: {
        ...pendingUploadMaterial.complexityResult,
        level: uploadModalLevel,
      },
    };

    persist([material, ...materials]);

    const { error } = await saveMaterialUpload({
      material_name: material.name,
      material_text: material.text,
      complexity_level: material.teacherVerifiedLevel || material.complexityResult.level,
      complexity_score: material.complexityResult.score,
      complexity_result: {
        ...material.complexityResult,
        originalFile: material.originalFile ?? null,
        teacherVerification: {
          level: material.teacherVerifiedLevel,
          comment: material.verificationComment || null,
          verifiedAt: material.teacherVerifiedAt,
        },
      },
      original_file: material.originalFile ?? null,
      teacher_verified_level: material.teacherVerifiedLevel ?? null,
      teacher_verified_at: material.teacherVerifiedAt ?? null,
      verification_comment: material.verificationComment ?? null,
      is_verified: true,
      subject: material.subject ?? null,
    });

    if (error) {
      setUploadError(`Database error: ${error}`);
    } else {
      try {
        const trainRes = await addTrainingSampleAPI(material.text, COMPLEXITY_TO_PHIL_IRI[uploadModalLevel]);
        if (trainRes.status !== 'ok') {
          setUploadError(trainRes.message || 'Sample saved but retraining is pending.');
        }
      } catch (e: any) {
        setUploadError(`Saved material, but model training failed: ${e?.message || 'unknown error'}`);
      }
      await refreshMaterials();
      onDataChanged?.();
    }

    setShowUploadCompareModal(false);
    setShowUploadVerifyModal(false);
    setPendingUploadMaterial(null);
    setUploadModalComment('');
    setSavingUploadDecision(false);
  };

  const handleContinueToTeacherVerification = () => {
    if (!pendingUploadMaterial) return;
    const nextName = pendingUploadMaterial.name.trim();
    if (!nextName) {
      setUploadError('Material title is required. Please enter a title before continuing.');
      return;
    }
    setPendingUploadMaterial({ ...pendingUploadMaterial, name: nextName });
    setShowUploadCompareModal(false);
    setShowUploadVerifyModal(true);
  };

  const handleRenamePendingMaterial = (value: string) => {
    setPendingUploadMaterial(prev => (prev ? { ...prev, name: value } : prev));
  };

  const processFile = useCallback(async (file: File) => {
    setUploadError(null);
    setUploadFileName(file.name);
    if (file.size > 10 * 1024 * 1024) { setUploadError('File too large (max 10 MB).'); return; }

    let text = '';
    let base64: string | undefined;
    let mimeType = file.type;

    const isText = file.type === 'text/plain' || file.type === 'text/markdown' || file.name.endsWith('.md') || file.name.endsWith('.txt');
    const isPdf = file.type === 'application/pdf';
    const isImage = file.type.startsWith('image/');

    // Images are staged for ordering before analysis
    if (isImage) {
      const reader = new FileReader();
      const b64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      }).catch(() => null);
      if (!b64) { setUploadError('Failed to read image file.'); return; }
      setStagedImages(prev => [...prev, { base64: b64, mimeType: file.type, name: file.name }]);
      setUploadFileName('');
      return;
    }

    if (isText) {
      text = await file.text();
    } else if (isPdf || isImage) {
      // Use FileReader for more robust base64 encoding
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const res = reader.result as string;
          // Extract the base64 part from the data URL
          const base64Data = res.split(',')[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(file);
      try {
        base64 = await base64Promise;
      } catch (err) {
        setUploadError('Failed to read file.');
        return;
      }
    } else {
      setUploadError('Unsupported file type. Use TXT, MD, PDF, or image.');
      return;
    }

    setUploading(true);
    try {
      const result: TextComplexityResult = await classifyTextComplexityAPI(text, base64, mimeType);
      
      // CRITICAL: Ensure we use the analyzed_text if it exists, otherwise fall back.
      // If it's still empty, it means analysis failed or text was truly empty.
      let extractedText = result.analyzed_text || text;

      if ((!extractedText || extractedText.trim().length === 0) && base64 && (isImage || isPdf)) {
        let warningMessage = null;
        try {
          const ocrResult = await extractTextFromImageAPI(base64, mimeType);
          const ocrError = (ocrResult as any)?.error;
          if (ocrError === 'api_key_invalid') {
            throw new Error('Gemini API key is expired or invalid. Please update GEMINI_API_KEY in .env.local and restart the backend.');
          } else if (ocrError === 'project_denied') {
            throw new Error('Gemini OCR access is denied for this Google project (403). Enable Generative Language API access/billing in Google Cloud or use another API key/project.');
          } else if (ocrError === 'no_api_key') {
            throw new Error('No Gemini API key configured. Add GEMINI_API_KEY to .env.local.');
          } else if (ocrError === 'ocr_timeout') {
            throw new Error('OCR timed out. Try a smaller file or upload again.');
          } else if (ocrError === 'ocr_unavailable') {
            throw new Error('OCR service is unavailable because google-generativeai is not installed on the backend.');
          } else if (ocrError === 'invalid_base64') {
            throw new Error('Uploaded file data is invalid. Please upload the file again.');
          }
          warningMessage = ocrResult.warning ?? null;
          extractedText = ocrResult.text;
        } catch (e: any) {
          if (e?.message?.includes('API key') || e?.message?.includes('Gemini')) throw e;
          // Preserve original error flow below
        }
        if (warningMessage) throw new Error(warningMessage);
      }
      
      extractedText = normalizeMaterialText(extractedText);

      if (!extractedText || extractedText.trim().length === 0) {
        throw new Error("No text could be extracted from this file. Please ensure it contains readable text.");
      }

      const fallbackTitle = file.name.replace(/\.[^.]+$/, '');
      let autoTitle = fallbackTitle;
      try {
        const ingestResult = await ingestReferenceAPI({ text: extractedText });
        const candidate = ingestResult?.title?.trim();
        const cleanedBody = ingestResult?.text?.trim();
        if (candidate) {
          autoTitle = candidate;
        }
        if (cleanedBody) {
          extractedText = normalizeMaterialText(cleanedBody);
        }
      } catch {
        // Keep filename fallback when title generation is unavailable.
      }

      const material: LibraryMaterial = {
        id: Date.now().toString(),
        name: autoTitle,
        text: extractedText,
        uploadedAt: new Date(),
        complexityResult: result,
        subject: normalizeSubjectName(uploadModalSubject) || undefined,
        originalFile: base64 ? { base64, mimeType, name: file.name } : undefined,
      };
      // Detect language for the new material
      let detectedLang: 'eng' | 'fil' = 'fil';
      try {
        detectedLang = await detectLanguageAPI(extractedText);
      } catch {
        // detectLanguageAPI is fail-safe but wrapping as extra guard
      }
      const materialWithLang: LibraryMaterial = { ...material, language: detectedLang };

      setPendingUploadMaterial(materialWithLang);
      setUploadModalLevel(materialWithLang.complexityResult.level);
      setUploadModalComment('');
      setShowUploadModal(false);
      setShowUploadCompareModal(true);
    } catch (e: any) {
      setUploadError(e.message || 'Analysis failed.');
    } finally {
      setUploading(false);
    }
  }, [uploadModalSubject]);

  const processStagedImages = useCallback(async () => {
    if (stagedImages.length === 0) return;
    setUploading(true);
    setUploadError(null);
    try {
      // OCR all images in order, concatenate text
      let combinedText = '';
      for (const img of stagedImages) {
        const ocrResult = await extractTextFromImageAPI(img.base64 ?? '', img.mimeType);
        const ocrError = (ocrResult as any)?.error;
        if (ocrError === 'api_key_invalid') throw new Error('Gemini API key is expired or invalid. Please update GEMINI_API_KEY in .env.local and restart the backend.');
        if (ocrError === 'project_denied') throw new Error('Gemini OCR access is denied for this Google project (403). Enable Generative Language API access/billing in Google Cloud or use another API key/project.');
        if (ocrError === 'no_api_key') throw new Error('No Gemini API key configured. Add GEMINI_API_KEY to .env.local.');
        if (ocrError === 'ocr_timeout') throw new Error('OCR timed out. Try a smaller image or upload again.');
        if (ocrResult?.text) combinedText += (combinedText ? '\n\n' : '') + ocrResult.text;
      }
      if (!combinedText.trim()) throw new Error('No text could be extracted from the images.');

      const result: TextComplexityResult = await classifyTextComplexityAPI(combinedText);
      let extractedText = normalizeMaterialText(result.analyzed_text || combinedText);

      const fallbackTitle = stagedImages[0].name.replace(/\.[^.]+$/, '');
      let autoTitle = fallbackTitle;
      try {
        const ingestResult = await ingestReferenceAPI({ text: extractedText });
        if (ingestResult?.title?.trim()) autoTitle = ingestResult.title.trim();
        if (ingestResult?.text?.trim()) extractedText = normalizeMaterialText(ingestResult.text.trim());
      } catch { /* keep fallback */ }

      let detectedLang: 'eng' | 'fil' = 'fil';
      try { detectedLang = await detectLanguageAPI(extractedText); } catch { /* keep fallback */ }

      const material: LibraryMaterial = {
        id: Date.now().toString(),
        name: autoTitle,
        text: extractedText,
        uploadedAt: new Date(),
        complexityResult: result,
        subject: normalizeSubjectName(uploadModalSubject) || undefined,
        originalFile: stagedImages[0],
        originalFiles: stagedImages,
        language: detectedLang,
      };
      setStagedImages([]);
      setPendingUploadMaterial(material);
      setUploadModalLevel(material.complexityResult.level);
      setUploadModalComment('');
      setShowUploadModal(false);
      setShowUploadCompareModal(true);
    } catch (e: any) {
      setUploadError(e.message || 'Analysis failed.');
    } finally {
      setUploading(false);
    }
  }, [stagedImages, uploadModalSubject]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(f => processFile(f));
    e.target.value = '';
  };

  const handleDragEnter = (e: React.DragEvent) => { e.preventDefault(); dragCount.current++; if (dragCount.current === 1) setIsDragging(true); };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); dragCount.current--; if (dragCount.current === 0) setIsDragging(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCount.current = 0;
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    files.forEach(file => processFile(file));
  };

  // Filtered + sorted + searched list
  const displayed = sortMaterials(
    materials.filter(m => {
      if (filter !== 'all' && m.complexityResult.level !== filter) return false;
      if (langFilter !== 'all' && m.language !== langFilter) return false;
      if (subjectFilter !== 'all' && (m.subject?.trim() || '') !== subjectFilter) return false;
      if (search && !m.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    }),
    sort
  );

  const sortLabels: Record<SortKey, string> = {
    newest: 'Newest first',
    oldest: 'Oldest first',
    score_high: 'Score: High → Low',
    score_low: 'Score: Low → High',
    name: 'Name A → Z',
  };

  const subjectCounts = availableSubjects.reduce<Record<string, number>>((acc, s) => {
    acc[s] = materials.filter(m => (m.subject?.trim() || '') === s).length;
    return acc;
  }, {});

  return (
    <div className="flex flex-col h-full bg-[#F5F4F0]">
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
              <div>
                <h2 className="text-base font-black text-gray-900">Upload Material (Mag-upload ng Materyal)</h2>
                <p className="text-xs text-gray-400 mt-0.5">Upload reading material for instant complexity analysis</p>
              </div>
              <button
                onClick={() => { setShowUploadModal(false); setUploadError(null); }}
                className="p-2 rounded-full hover:bg-gray-100 text-gray-400"
              >
                <IoCloseOutline className="text-lg" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {/* Subject selector */}
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Subject</label>
                <select
                  value={uploadModalSubject}
                  onChange={e => setUploadModalSubject(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-teal-300"
                >
                  <option value="">Select subject…</option>
                  {availableSubjects.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <p className="mt-1 text-[10px] text-gray-400">Required. Add subjects from the left sidebar.</p>
              </div>

              <div
                className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center gap-2 cursor-pointer transition-colors ${
                  isDragging ? 'border-teal-400 bg-teal-50' : 'border-gray-200 hover:border-teal-300 bg-gray-50'
                }`}
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploading ? (
                  <>
                    <div className="w-6 h-6 rounded-full border-2 border-teal-400 border-t-transparent animate-spin" />
                    <div className="text-center">
                      <div className="text-xs font-bold text-teal-600">Extracting and analyzing…</div>
                      <div className="text-[10px] text-gray-400">{uploadFileName || 'Processing file'} · OCR via Gemini when needed</div>
                    </div>
                  </>
                ) : (
                  <>
                    <IoCloudUploadOutline className={`text-3xl ${isDragging ? 'text-teal-500' : 'text-gray-300'}`} />
                    <div className="text-center">
                      <div className="text-xs font-bold text-gray-700">{uploadFileName || 'Click or drag a file'}</div>
                      <div className="text-[10px] text-gray-400">TXT, MD, PDF, or image · Max 10MB</div>
                    </div>
                  </>
                )}
              </div>

              {/* Staged images queue */}
              {stagedImages.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                    Images ({stagedImages.length}) — drag to reorder
                  </div>
                  {stagedImages.map((img, i) => (
                    <div key={i} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
                      <span className="w-5 text-[10px] font-bold text-gray-400 text-center shrink-0">{i + 1}</span>
                      <img
                        src={`data:${img.mimeType};base64,${img.base64}`}
                        alt={img.name}
                        className="w-9 h-9 object-cover rounded-lg border border-gray-200 shrink-0"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                      <span className="text-xs text-gray-700 flex-1 truncate">{img.name}</span>
                      <button
                        onClick={() => setStagedImages(prev => { const n = [...prev]; if (i > 0) [n[i-1], n[i]] = [n[i], n[i-1]]; return n; })}
                        disabled={i === 0}
                        className="p-1 rounded-lg text-gray-400 hover:text-gray-700 disabled:opacity-25"
                      ><IoChevronUpOutline className="text-sm" /></button>
                      <button
                        onClick={() => setStagedImages(prev => { const n = [...prev]; if (i < n.length-1) [n[i], n[i+1]] = [n[i+1], n[i]]; return n; })}
                        disabled={i === stagedImages.length - 1}
                        className="p-1 rounded-lg text-gray-400 hover:text-gray-700 disabled:opacity-25"
                      ><IoChevronDownOutline className="text-sm" /></button>
                      <button
                        onClick={() => setStagedImages(prev => prev.filter((_, j) => j !== i))}
                        className="p-1 rounded-lg text-red-400 hover:text-red-600"
                      ><IoTrashOutline className="text-sm" /></button>
                    </div>
                  ))}
                  <button
                    onClick={processStagedImages}
                    disabled={uploading}
                    className="w-full py-2 rounded-xl bg-teal-500 hover:bg-teal-600 disabled:bg-gray-100 disabled:text-gray-400 text-white font-black text-xs transition-colors flex items-center justify-center gap-2"
                  >
                    {uploading
                      ? <><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Analyzing…</>
                      : `Analyze ${stagedImages.length} Image${stagedImages.length > 1 ? 's' : ''} →`}
                  </button>
                </div>
              )}

              {uploadError && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl px-4 py-3 flex items-center justify-between">
                  {uploadError}
                  <button onClick={() => setUploadError(null)}><IoCloseOutline /></button>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                <button
                  type="button"
                  onClick={() => setShowPhilIriHelp(v => !v)}
                  className="flex items-center gap-1 text-left text-[10px] font-bold uppercase tracking-wider text-blue-600 mb-1"
                  aria-expanded={showPhilIriHelp}
                  aria-controls="phil-iri-help-upload"
                >
                  <span>Grade 7 Readability Check (Philippines DepEd)</span>
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-white/80 border border-blue-200">
                    <IoInformationCircleOutline className="text-[11px]" />
                  </span>
                </button>
                {showPhilIriHelp ? (
                  <p id="phil-iri-help-upload" className="text-xs text-blue-700 leading-relaxed">
                    {PHIL_IRI_HELP}
                  </p>
                ) : (
                  <p className="text-xs text-blue-700 leading-relaxed">
                    <span className="font-semibold">Literal</span> = Easy, students can read independently.{' '}
                    <span className="font-semibold">Inferential</span> = Borderline, may need teacher support.{' '}
                    <span className="font-semibold">Evaluative</span> = Above G7, not recommended without scaffolding.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showUploadCompareModal && pendingUploadMaterial && (
        <UploadCompareModal
          material={pendingUploadMaterial}
          materialName={pendingUploadMaterial.name}
          onChangeName={handleRenamePendingMaterial}
          onCancel={() => {
            setShowUploadCompareModal(false);
            setPendingUploadMaterial(null);
            setUploadModalComment('');
          }}
          onContinue={handleContinueToTeacherVerification}
        />
      )}

      {showUploadVerifyModal && pendingUploadMaterial && (
        <UploadVerificationModal
          material={pendingUploadMaterial}
          selectedLevel={uploadModalLevel}
          comment={uploadModalComment}
          saving={savingUploadDecision}
          onSelectLevel={setUploadModalLevel}
          onChangeComment={setUploadModalComment}
          onCancel={() => {
            setShowUploadVerifyModal(false);
            setPendingUploadMaterial(null);
            setUploadModalComment('');
          }}
          onConfirm={handleFinalizePendingUpload}
        />
      )}

      {selected && (
        <DetailModal
          material={selected}
          onClose={() => setSelected(null)}
          onDelete={handleDelete}
          onUpdate={handleUpdate}
          onVerify={handleVerifyMaterial}
        />
      )}

      {/* Header */}
      <header className="h-14 flex items-center justify-between px-5 border-b border-gray-100 bg-white shadow-sm shrink-0">
        <div className="flex items-center gap-2">
          {onMenuClick && (
            <button onClick={onMenuClick} className="md:hidden text-gray-500 hover:text-gray-700">
              <IoMenuOutline className="text-2xl" />
            </button>
          )}
          <IoBookOutline className="text-teal-500 text-xl" />
          <h1 className="text-base font-bold text-gray-800">Material Library</h1>
          <span className="text-[10px] font-semibold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{materials.length}</span>
        </div>
        <input ref={fileInputRef} type="file" accept=".txt,.md,image/*,.pdf" className="hidden" onChange={handleFileChange} />
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 shrink-0 flex flex-col h-full bg-white border-r border-gray-100 overflow-y-auto">
          {/* Upload button */}
          <div className="px-4 py-3 border-b border-gray-100 shrink-0">
            <button
              onClick={() => { setUploadError(null); setShowUploadModal(true); }}
              disabled={uploading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold transition-colors shadow-sm cursor-pointer"
            >
              <IoCloudUploadOutline className="text-base" />
              {uploading ? 'Analyzing…' : 'Upload Material'}
            </button>
          </div>
          {/* Subjects header */}
          <div className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0">
            <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">Subjects</span>
            <button
              onClick={() => { setShowAddSubjectPanel(p => !p); setSubjectPanelError(null); }}
              className="flex items-center gap-1 text-[9px] font-bold text-indigo-500 hover:text-indigo-700"
            >
              <IoAddOutline className="text-[11px]" /> Add
            </button>
          </div>

          {showAddSubjectPanel && (
            <div className="px-3 pb-3 space-y-1.5">
              <input
                autoFocus
                className="w-full text-xs border border-indigo-300 rounded-lg px-2 py-1.5 outline-none bg-white"
                placeholder="New subject name…"
                value={newSubjectName}
                onChange={e => setNewSubjectName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddSubject(); if (e.key === 'Escape') setShowAddSubjectPanel(false); }}
              />
              {subjectPanelError && <p className="text-[10px] text-red-500">{subjectPanelError}</p>}
              <button
                onClick={handleAddSubject}
                disabled={savingSubjectPanel}
                className="w-full py-1.5 rounded-lg bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white text-[11px] font-bold"
              >
                {savingSubjectPanel ? 'Saving…' : 'Add Subject'}
              </button>
            </div>
          )}

          {/* Subject list */}
          <div className="flex-1 px-2 pb-2 space-y-0.5">
            <button
              onClick={() => setSubjectFilter('all')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs font-semibold transition-colors ${
                subjectFilter === 'all' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-indigo-300 shrink-0" />
              <span className="flex-1">All Subjects</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-400">{materials.length}</span>
            </button>
            {availableSubjects.map(subject => {
              const isActive = subjectFilter === subject;
              return (
                <button
                  key={subject}
                  onClick={() => setSubjectFilter(subject)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs font-semibold transition-colors ${
                    isActive ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 ${isActive ? 'bg-indigo-500' : 'bg-gray-300'}`} />
                  <span className="flex-1 truncate">{subject}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/50' : 'bg-gray-100 text-gray-400'}`}>
                    {subjectCounts[subject] ?? 0}
                  </span>
                </button>
              );
            })}
            {availableSubjects.length === 0 && (
              <p className="text-[11px] text-gray-300 px-3 py-2">No subjects yet</p>
            )}
          </div>

        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#F5F4F0]">

          {/* Toolbar */}
          <div className="flex items-center justify-between px-5 py-3 bg-[#F5F4F0] border-b border-gray-200/60 shrink-0 gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-bold text-gray-800 truncate">
                {subjectFilter === 'all' ? 'All Materials' : subjectFilter}
              </span>
              <span className="text-[10px] text-gray-400 shrink-0">· {displayed.length}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="relative">
                <IoSearchOutline className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search…"
                  className="text-sm border border-gray-200 rounded-xl pl-8 pr-3 py-2 bg-white outline-none w-36 focus:ring-2 focus:ring-teal-200 focus:border-teal-300 shadow-sm"
                />
              </div>
              <select
                value={sort}
                onChange={e => setSort(e.target.value as SortKey)}
                className="text-xs border border-gray-200 rounded-xl px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-teal-200 shadow-sm"
              >
                {(Object.entries(sortLabels) as [SortKey, string][]).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Filter pills */}
          <div className="flex gap-1.5 px-5 py-2 border-b border-gray-200/60 bg-[#F5F4F0] shrink-0 flex-wrap items-center">
            {([
              { key: 'all' as const, label: 'All', dot: null, pill: null },
              { key: ComplexityLevel.LITERAL,     label: 'Independent',   dot: levelMeta[ComplexityLevel.LITERAL].dot,     pill: 'bg-green-50 text-green-700 border-green-200'  },
              { key: ComplexityLevel.INFERENTIAL, label: 'Instructional', dot: levelMeta[ComplexityLevel.INFERENTIAL].dot, pill: 'bg-orange-50 text-orange-700 border-orange-200' },
              { key: ComplexityLevel.EVALUATIVE,  label: 'Frustration',   dot: levelMeta[ComplexityLevel.EVALUATIVE].dot,  pill: 'bg-red-50 text-red-700 border-red-200'        },
            ]).map(({ key, label, dot, pill }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all ${
                  filter === key
                    ? pill ?? 'bg-teal-50 text-teal-700 border-teal-200'
                    : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'
                }`}
              >
                {dot && <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />}
                {label}
              </button>
            ))}
            <div className="w-px h-4 bg-gray-200 mx-0.5 self-center" />
            {([
              { key: 'all' as const, label: 'All Lang' },
              { key: 'eng' as const, label: '🇬🇧 EN' },
              { key: 'fil' as const, label: '🇵🇭 FIL' },
            ]).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setLangFilter(key)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all ${
                  langFilter === key
                    ? 'bg-sky-50 text-sky-700 border-sky-200'
                    : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Error */}
          {uploadError && (
            <div className="mx-5 mt-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl px-4 py-3 flex items-center justify-between shrink-0">
              {uploadError}
              <button onClick={() => setUploadError(null)}><IoCloseOutline /></button>
            </div>
          )}

          {/* Loading */}
          {materialsLoading && (
            <div className="flex flex-col items-center justify-center flex-1">
              <div className="w-8 h-8 rounded-full border-2 border-teal-500 border-t-transparent animate-spin mb-3" />
              <p className="text-sm text-gray-400">Loading materials…</p>
            </div>
          )}

          {/* Empty state */}
          {!materialsLoading && materials.length === 0 && (
            <div className="flex flex-col items-center justify-center flex-1 gap-2">
              <div className="w-10 h-10 rounded-2xl bg-teal-50 flex items-center justify-center">
                <IoBookOutline className="text-teal-400 text-xl" />
              </div>
              <p className="text-sm font-semibold text-gray-500">No materials yet</p>
              <button
                onClick={() => { setUploadError(null); setShowUploadModal(true); }}
                className="text-xs text-teal-500 hover:text-teal-700 font-semibold underline"
              >
                Upload your first material
              </button>
            </div>
          )}

          {/* No filter results */}
          {!materialsLoading && materials.length > 0 && displayed.length === 0 && (
            <div className="flex items-center justify-center flex-1 text-sm text-gray-400">
              No materials match the current filters.
            </div>
          )}

          {/* Material list */}
          {!materialsLoading && displayed.length > 0 && (
            <div className="flex-1 overflow-y-auto">
              {/* Column headers */}
              <div className="flex items-center px-4 py-1.5 border-b border-gray-50 bg-gray-50/50">
                <span className="w-3 shrink-0 mr-3" />
                <span className="flex-1 text-[9px] font-black uppercase tracking-widest text-gray-400">Material</span>
                <span className="w-24 text-[9px] font-black uppercase tracking-widest text-gray-400 text-center">Level</span>
                <span className="w-14 text-[9px] font-black uppercase tracking-widest text-gray-400 text-center">Score</span>
                <span className="w-14 text-[9px] font-black uppercase tracking-widest text-gray-400 text-center">Words</span>
                <span className="w-14 text-[9px] font-black uppercase tracking-widest text-gray-400 text-right">Date</span>
                <span className="w-7" />
              </div>

              {displayed.map(mat => {
                const meta = levelMeta[mat.complexityResult.level] ?? levelMeta[ComplexityLevel.LITERAL];
                const cr = mat.complexityResult;
                return (
                  <div
                    key={mat.id}
                    onClick={() => setSelected(mat)}
                    className="group flex items-center px-4 py-3 border-b border-gray-100 bg-white hover:bg-indigo-50/30 cursor-pointer transition-colors"
                  >
                    {/* Level bar */}
                    <div className={`w-1 h-8 rounded-full shrink-0 mr-3 ${meta.dot}`} />

                    {/* Name + badges */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                        {mat.subject && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100">
                            {mat.subject}
                          </span>
                        )}
                        {mat.language && (
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${
                            mat.language === 'eng'
                              ? 'bg-sky-50 text-sky-600 border-sky-100'
                              : 'bg-rose-50 text-rose-600 border-rose-100'
                          }`}>
                            {mat.language === 'eng' ? 'EN' : 'FIL'}
                          </span>
                        )}
                      </div>
                      <span className="text-sm font-semibold text-gray-800 truncate block group-hover:text-teal-700 transition-colors">
                        {mat.name}
                      </span>
                    </div>

                    {/* Level badge */}
                    <div className="w-24 flex justify-center">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${meta.badge}`}>
                        {meta.label}
                      </span>
                    </div>

                    {/* Score */}
                    <div className="w-14 text-center">
                      <span className={`text-sm font-black ${meta.text}`}>
                        {typeof cr.score === 'number' ? cr.score : '—'}
                      </span>
                    </div>

                    {/* Words */}
                    <div className="w-14 text-center text-xs text-gray-400">
                      {cr.wordCount ?? '—'}
                    </div>

                    {/* Date */}
                    <div className="w-14 text-right text-[10px] text-gray-400">
                      {new Date(mat.uploadedAt).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                    </div>

                    {/* Delete */}
                    <div className="w-7 flex justify-end">
                      <button
                        onClick={e => { e.stopPropagation(); handleDelete(mat.id); }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all"
                      >
                        <IoTrashOutline className="text-xs" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>{/* end main content */}
      </div>{/* end flex row */}
    </div>
  );
};
