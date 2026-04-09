import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
  IoCloudUploadOutline,
  IoDocumentTextOutline,
  IoSearchOutline,
  IoTrashOutline,
  IoCloseOutline,
  IoMenuOutline,
  IoTimeOutline,
  IoBookOutline,
  IoFunnelOutline,
  IoChevronDownOutline,
  IoImageOutline,
} from 'react-icons/io5';
import { LibraryMaterial, TextComplexityResult, ComplexityLevel } from '../types';
import { classifyTextComplexityAPI, extractTextFromImageAPI, detectLanguageAPI, addTrainingSampleAPI } from '../services/pythonService';
import { saveMaterialUpload, loadMaterialUploads, deleteMaterialUpload, saveMaterialTeacherVerification } from '../services/supabaseService';
import { useEffect } from 'react';
import { IoDocumentOutline } from 'react-icons/io5';



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
  const meta = levelMeta[material.complexityResult.level] ?? levelMeta[ComplexityLevel.LITERAL];
  const cr = material.complexityResult;
  const { summary: reasoningSummary, tags: reasoningTags } = parseReasoning(
    cr.reasoning, material.complexityResult.level
  );

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
              {material.originalFile ? (
                <div className="flex gap-4">
                  {/* Left: original file */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase mb-2">Original File</p>
                    {safeImageMime ? (
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

              {/* Complexity summary */}
              <div className={`rounded-xl border p-4 ${meta.bg} ${meta.border}`}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                  {[
                    { label: 'Complexity Score', value: cr.score ?? 'N/A' },
                    { label: 'Readability Score', value: cr.readabilityScore ?? 'N/A' },
                    { label: 'Est. Reading Time', value: `${cr.estimatedReadingTime ?? '?'} min` },
                    { label: 'Avg Sentence Len', value: `${cr.avgSentenceLength ?? '?'} words` },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <div className={`text-[10px] font-bold uppercase tracking-wide mb-0.5 ${meta.text} opacity-70`}>{label}</div>
                      <div className={`text-lg font-bold ${meta.text}`}>{value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Readability indices */}
              {cr.readability && (
                <div className="grid grid-cols-2 gap-3">
                  {cr.readability.flesch_kincaid !== undefined && (
                    <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-center">
                      <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-0.5">Flesch-Kincaid Grade</div>
                      <div className="text-xl font-bold text-teal-600">{cr.readability.flesch_kincaid}</div>
                    </div>
                  )}
                  {cr.readability.gunning_fog !== undefined && (
                    <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-center">
                      <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-0.5">Gunning Fog Index</div>
                      <div className="text-xl font-bold text-teal-600">{cr.readability.gunning_fog}</div>
                    </div>
                  )}
                </div>
              )}

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
  selectedLevel: ComplexityLevel;
  comment: string;
  saving: boolean;
  onSelectLevel: (level: ComplexityLevel) => void;
  onChangeComment: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

const UploadVerificationModal: React.FC<UploadVerificationModalProps> = ({
  material,
  selectedLevel,
  comment,
  saving,
  onSelectLevel,
  onChangeComment,
  onCancel,
  onConfirm,
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-gray-100">
          <div>
            <h3 className="text-base font-black text-gray-900">Confirm Material Level</h3>
            <p className="text-xs text-gray-500 mt-1">
              Model predicted: <span className="font-semibold">{material.complexityResult.level}</span>
            </p>
          </div>
          <button onClick={onCancel} className="p-2 rounded-full hover:bg-gray-100 text-gray-400">
            <IoCloseOutline className="text-lg" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div className="flex gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold text-gray-400 uppercase mb-2">Original File</p>
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
                  <div className="flex flex-col items-center justify-center gap-3 p-8 bg-blue-50 rounded-lg border border-blue-100 min-h-[240px]">
                    <IoDocumentOutline className="text-5xl text-blue-400" />
                    <div className="text-center">
                      <p className="text-sm font-bold text-blue-700">{material.originalFile.name}</p>
                      <p className="text-[11px] text-blue-500 mt-1">Word Document — no browser preview available</p>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-gray-400 italic p-4 bg-gray-50 rounded-lg border border-gray-200">
                    No preview available for this file type.
                  </div>
                )
              ) : (
                <div className="text-xs text-gray-400 italic p-4 bg-gray-50 rounded-lg border border-gray-200 min-h-[240px] flex items-center justify-center">
                  No original file attached.
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold text-gray-400 uppercase mb-2">Extracted Text</p>
              <textarea
                value={material.text}
                readOnly
                className="w-full min-h-[420px] bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs text-gray-700 leading-relaxed outline-none resize-none"
              />
            </div>
          </div>

          <div>
            <div className="text-[11px] text-gray-500 mb-2">Choose the teacher-verified level:</div>
            <div className="flex flex-wrap gap-2 mb-2">
              {(Object.values(ComplexityLevel) as ComplexityLevel[]).map(level => (
                <button
                  key={level}
                  onClick={() => onSelectLevel(level)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-colors ${
                    selectedLevel === level
                      ? 'bg-teal-600 text-white border-teal-600'
                      : 'bg-white text-teal-700 border-teal-200 hover:border-teal-400'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-teal-700 mb-3">{LEVEL_DESCRIPTIONS[selectedLevel]}</p>

            <textarea
              value={comment}
              onChange={e => onChangeComment(e.target.value)}
              placeholder="Optional note for this decision"
              className="w-full min-h-[80px] bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs outline-none focus:ring-1 focus:ring-teal-400"
            />
          </div>
        </div>

        <div className="px-6 pb-6 pt-2 flex items-center justify-end gap-2 border-t border-gray-100">
          <button
            onClick={onCancel}
            disabled={saving}
            className="px-4 py-2 text-xs font-semibold rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={saving}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors ${saving ? 'bg-gray-100 text-gray-400' : 'bg-teal-600 text-white hover:bg-teal-700'}`}
          >
            {saving ? 'Saving…' : 'Save & Continue'}
          </button>
        </div>
      </div>
    </div>
  );
};

interface MaterialLibraryProps {
  onMenuClick?: () => void;
}

export const MaterialLibrary: React.FC<MaterialLibraryProps> = ({ onMenuClick }) => {
  const [materials, setMaterials] = useState<LibraryMaterial[]>([]);
  const [materialsLoading, setMaterialsLoading] = useState(true);
  const [filter, setFilter] = useState<ComplexityLevel | 'all'>('all');
  const [sort, setSort] = useState<SortKey>('newest');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<LibraryMaterial | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadFileName, setUploadFileName] = useState<string>('');
  const [pendingUploadMaterial, setPendingUploadMaterial] = useState<LibraryMaterial | null>(null);
  const [showUploadVerifyModal, setShowUploadVerifyModal] = useState(false);
  const [uploadModalLevel, setUploadModalLevel] = useState<ComplexityLevel>(ComplexityLevel.LITERAL);
  const [uploadModalComment, setUploadModalComment] = useState('');
  const [savingUploadDecision, setSavingUploadDecision] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [langFilter, setLangFilter] = useState<'all' | 'eng' | 'fil'>('all');
  const dragCount = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    loadMaterialUploads().then(async ({ data, error }) => {
      if (!cancelled) {
        if (!error && data.length > 0) {
          let langs: Array<'eng' | 'fil'>;
          try {
            langs = await Promise.all(data.map(m => detectLanguageAPI(m.text)));
          } catch {
            langs = data.map(() => 'fil' as const);
          }
          const withLangs = data.map((m, i) => ({ ...m, language: langs[i] }));
          setMaterials(withLangs);
        } else if (!error) {
          setMaterials(data);
        }
        setMaterialsLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  const refreshMaterials = async () => {
    const { data, error } = await loadMaterialUploads();
    if (error) return;
    if (data.length > 0) {
      let langs: Array<'eng' | 'fil'>;
      try {
        langs = await Promise.all(data.map(m => detectLanguageAPI(m.text)));
      } catch {
        langs = data.map(() => 'fil' as const);
      }
      setMaterials(data.map((m, i) => ({ ...m, language: langs[i] })));
    } else {
      setMaterials(data);
    }
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
    const saveRes = await saveMaterialTeacherVerification(material.id, { level, comment }, material.complexityResult);
    if (saveRes.error) {
      return { ok: false, message: `Could not save verification: ${saveRes.error}` };
    }

    let message = 'Teacher verification saved.';
    let ok = true;
    try {
      const trainRes = await addTrainingSampleAPI(material.text, level);
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
    });

    if (error) {
      setUploadError(`Database error: ${error}`);
    } else {
      try {
        const trainRes = await addTrainingSampleAPI(material.text, uploadModalLevel);
        if (trainRes.status !== 'ok') {
          setUploadError(trainRes.message || 'Sample saved but retraining is pending.');
        }
      } catch (e: any) {
        setUploadError(`Saved material, but model training failed: ${e?.message || 'unknown error'}`);
      }
      await refreshMaterials();
    }

    setShowUploadVerifyModal(false);
    setPendingUploadMaterial(null);
    setUploadModalComment('');
    setSavingUploadDecision(false);
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

      const material: LibraryMaterial = {
        id: Date.now().toString(),
        name: file.name.replace(/\.[^.]+$/, ''),
        text: extractedText,
        uploadedAt: new Date(),
        complexityResult: result,
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
      setShowUploadVerifyModal(true);
    } catch (e: any) {
      setUploadError(e.message || 'Analysis failed.');
    } finally {
      setUploading(false);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  };

  const handleDragEnter = (e: React.DragEvent) => { e.preventDefault(); dragCount.current++; if (dragCount.current === 1) setIsDragging(true); };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); dragCount.current--; if (dragCount.current === 0) setIsDragging(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCount.current = 0;
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  // Filtered + sorted + searched list
  const displayed = sortMaterials(
    materials.filter(m => {
      if (filter !== 'all' && m.complexityResult.level !== filter) return false;
      if (langFilter !== 'all' && m.language !== langFilter) return false;
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

  const counts = {
    all: materials.length,
    [ComplexityLevel.LITERAL]: materials.filter(m => m.complexityResult.level === ComplexityLevel.LITERAL).length,
    [ComplexityLevel.INFERENTIAL]: materials.filter(m => m.complexityResult.level === ComplexityLevel.INFERENTIAL).length,
    [ComplexityLevel.EVALUATIVE]: materials.filter(m => m.complexityResult.level === ComplexityLevel.EVALUATIVE).length,
  };

  const langCounts = {
    eng: materials.filter(m => m.language === 'eng').length,
    fil: materials.filter(m => m.language === 'fil').length,
  };

  return (
    <div className="flex flex-col h-full bg-[#F2F2F7]">
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

              {uploadError && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl px-4 py-3 flex items-center justify-between">
                  {uploadError}
                  <button onClick={() => setUploadError(null)}><IoCloseOutline /></button>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-blue-600 mb-1">
                  Grade 7 Readability Check (Philippines DepEd)
                </div>
                <p className="text-xs text-blue-700 leading-relaxed">
                  <span className="font-semibold">Literal</span> = Easy, students can read independently.{' '}
                  <span className="font-semibold">Inferential</span> = Borderline, may need teacher support.{' '}
                  <span className="font-semibold">Evaluative</span> = Above G7, not recommended without scaffolding.
                </p>
              </div>
            </div>
          </div>
        </div>
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
        <button
          onClick={() => { setUploadError(null); setShowUploadModal(true); }}
          disabled={uploading}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-xs font-semibold transition-colors disabled:opacity-60"
        >
          <IoCloudUploadOutline className="text-base" />
          {uploading ? 'Analyzing…' : 'Upload Material'}
        </button>
        <input ref={fileInputRef} type="file" accept=".txt,.md,image/*,.pdf" className="hidden" onChange={handleFileChange} />
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-5 py-5 space-y-4">

          {uploadError && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl px-4 py-3 flex items-center justify-between">
              {uploadError}
              <button onClick={() => setUploadError(null)}><IoCloseOutline /></button>
            </div>
          )}

          {/* Upload note */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-blue-600 mb-1">
              Grade 7 Readability Check (Philippines DepEd)
            </div>
            <p className="text-xs text-blue-700 leading-relaxed">
              <span className="font-semibold">Literal</span> = Easy, students can read independently.{' '}
              <span className="font-semibold">Inferential</span> = Borderline, may need teacher support.{' '}
              <span className="font-semibold">Evaluative</span> = Above G7, not recommended without scaffolding.
            </p>
          </div>

          {/* Search + Sort row */}
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <IoSearchOutline className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search materials…"
                className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 bg-white rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-300"
              />
            </div>
            <div className="relative">
              <button
                onClick={() => setShowSortMenu(s => !s)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:border-teal-300 transition-colors"
              >
                <IoFunnelOutline className="text-sm" />
                {sortLabels[sort]}
                <IoChevronDownOutline className={`text-xs transition-transform ${showSortMenu ? 'rotate-180' : ''}`} />
              </button>
              {showSortMenu && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-gray-100 rounded-xl shadow-lg z-20 min-w-[170px] overflow-hidden">
                  {(Object.entries(sortLabels) as [SortKey, string][]).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => { setSort(key); setShowSortMenu(false); }}
                      className={`w-full text-left px-4 py-2.5 text-xs hover:bg-gray-50 transition-colors ${sort === key ? 'text-teal-600 font-semibold bg-teal-50' : 'text-gray-600'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-2 flex-wrap items-center">
            {/* Language filters */}
            {([
              { key: 'all' as const, label: 'All', count: materials.length },
              { key: 'eng' as const, label: '🇬🇧 English', count: langCounts.eng },
              { key: 'fil' as const, label: '🇵🇭 Filipino', count: langCounts.fil },
            ]).map(({ key, label, count }) => (
              <button
                key={key}
                onClick={() => setLangFilter(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                  langFilter === key
                    ? 'bg-teal-50 text-teal-700 border-teal-200'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                }`}
              >
                {label}
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${langFilter === key ? 'bg-white/60' : 'bg-gray-100'}`}>
                  {count}
                </span>
              </button>
            ))}

            {/* Divider */}
            <div className="w-px h-5 bg-gray-200 mx-1" />

            {/* Complexity filters */}
            {([
              { key: 'all' as const, label: 'All', meta: null },
              { key: ComplexityLevel.LITERAL, label: 'Literal', meta: levelMeta[ComplexityLevel.LITERAL] },
              { key: ComplexityLevel.INFERENTIAL, label: 'Inferential', meta: levelMeta[ComplexityLevel.INFERENTIAL] },
              { key: ComplexityLevel.EVALUATIVE, label: 'Evaluative', meta: levelMeta[ComplexityLevel.EVALUATIVE] },
            ]).map(({ key, label, meta: m }) => {
              const count = counts[key];
              const isActive = filter === key;
              return (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                    isActive
                      ? m ? `${m.bg} ${m.text} ${m.border}` : 'bg-teal-50 text-teal-700 border-teal-200'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {m && <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />}
                  {label}
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${isActive ? 'bg-white/60' : 'bg-gray-100'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Loading state */}
          {materialsLoading && (
            <div className="flex flex-col items-center justify-center h-60">
              <div className="w-8 h-8 rounded-full border-2 border-teal-500 border-t-transparent animate-spin mb-3" />
              <p className="text-sm text-gray-400">Loading materials...</p>
            </div>
          )}

          {/* Empty-state helper text */}
          {!materialsLoading && materials.length === 0 && (
            <div className="text-center py-8 text-sm text-gray-400">
              Upload your first material to start your library.
            </div>
          )}

          {/* No results */}
          {materials.length > 0 && displayed.length === 0 && (
            <div className="text-center py-12 text-sm text-gray-400">
              No materials match your current filter or search.
            </div>
          )}

          {/* Material cards grid */}
          {displayed.length > 0 && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayed.map(mat => {
                const meta = levelMeta[mat.complexityResult.level] ?? levelMeta[ComplexityLevel.LITERAL];
                const cr = mat.complexityResult;
                return (
                  <div
                    key={mat.id}
                    onClick={() => setSelected(mat)}
                    className="group text-left bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all relative overflow-hidden cursor-pointer"
                  >
                    {/* Level color bar */}
                    <div className={`absolute top-0 left-0 right-0 h-1 rounded-t-2xl ${meta.dot}`} />

                    <div className="flex items-start justify-between gap-2 mb-3 pt-1">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                          <div className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${meta.badge}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                            {meta.label}
                          </div>
                          {mat.language && (
                            <span className={`inline-flex items-center text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${
                              mat.language === 'eng'
                                ? 'bg-blue-50 text-blue-600 border-blue-100'
                                : 'bg-purple-50 text-purple-600 border-purple-100'
                            }`}>
                              {mat.language === 'eng' ? '🇬🇧 EN' : '🇵🇭 FIL'}
                            </span>
                          )}
                        </div>
                        <h3 className="text-sm font-semibold text-gray-800 truncate group-hover:text-teal-600 transition-colors">
                          {mat.name}
                        </h3>
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); handleDelete(mat.id); }}
                        className="shrink-0 p-1.5 rounded-lg text-gray-200 hover:text-red-400 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <IoTrashOutline className="text-xs" />
                      </button>
                    </div>

                    {/* Score */}
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex-1">
                        <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                          <span>Complexity Score</span>
                          <span className={`font-bold ${meta.text}`}>{typeof cr.score === 'number' ? cr.score : 'N/A'}</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${meta.dot}`}
                            style={{ width: `${typeof cr.score === 'number' ? Math.min(100, cr.score) : 0}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Meta row */}
                    <div className="flex items-center gap-3 text-[10px] text-gray-400">
                      <span className="flex items-center gap-1">
                        <IoDocumentTextOutline className="text-xs" />
                        {cr.wordCount} words
                      </span>
                      <span className="flex items-center gap-1">
                        <IoTimeOutline className="text-xs" />
                        {cr.estimatedReadingTime} min
                      </span>
                      <span className="ml-auto">
                        {new Date(mat.uploadedAt).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>

                    {/* G7 readability note */}
                    <div className={`mt-3 pt-3 border-t border-gray-50 text-[10px] font-medium ${meta.text}`}>
                      {meta.desc}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
