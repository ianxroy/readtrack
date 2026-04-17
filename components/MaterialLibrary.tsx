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
  IoChevronUpOutline,
  IoImageOutline,
  IoInformationCircleOutline,
} from 'react-icons/io5';
import { LibraryMaterial, TextComplexityResult, ComplexityLevel, OriginalFile } from '../types';
import { classifyTextComplexityAPI, extractTextFromImageAPI, detectLanguageAPI, addTrainingSampleAPI, ingestReferenceAPI, detectLanguageClientSide, triggerRetrainAPI } from '../services/pythonService';
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
    label: 'Independent', desc: 'Easy — G7 Readable',
  },
  [ComplexityLevel.INFERENTIAL]: {
    bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200',
    dot: 'bg-orange-500', badge: 'bg-orange-50 text-orange-700 border-orange-200',
    label: 'Instructional', desc: 'Moderate — G7 Borderline',
  },
  [ComplexityLevel.EVALUATIVE]: {
    bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200',
    dot: 'bg-red-500', badge: 'bg-red-50 text-red-700 border-red-200',
    label: 'Frustration', desc: 'Difficult — Above G7',
  },
};

const toPhilIriLabel = (level: ComplexityLevel): 'Independent' | 'Instructional' | 'Frustration' =>
  levelMeta[level]?.label as 'Independent' | 'Instructional' | 'Frustration' ?? 'Instructional';

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

const REASONING_SUMMARIES_FIL: Record<ComplexityLevel, string> = {
  [ComplexityLevel.LITERAL]: 'Gumagamit ang materyal na ito ng payak na salita at maiikling pangungusap na kayang basahin ng Grade 7 nang mag-isa.',
  [ComplexityLevel.INFERENTIAL]: 'Kailangang maghinuha ng mga mag-aaral sa materyal na ito; maaaring kailanganin ang gabay ng guro.',
  [ComplexityLevel.EVALUATIVE]: 'Mas masalimuot ang ideya at wika ng materyal na ito para sa Grade 7 kaya inirerekomenda ang scaffolding.',
};

const LEVEL_DESCRIPTIONS: Record<ComplexityLevel, string> = {
  [ComplexityLevel.LITERAL]: 'Independent: suitable for independent Grade 7 reading.',
  [ComplexityLevel.INFERENTIAL]: 'Instructional: may need teacher guidance.',
  [ComplexityLevel.EVALUATIVE]: 'Frustration: likely needs strong teacher support.',
};

const LEVEL_DESCRIPTIONS_FIL: Record<ComplexityLevel, string> = {
  [ComplexityLevel.LITERAL]: 'Independent (Mahusay): akma sa independiyenteng pagbasa ng Grade 7.',
  [ComplexityLevel.INFERENTIAL]: 'Instructional (Papaunlad): maaaring kailanganin ng gabay ng guro.',
  [ComplexityLevel.EVALUATIVE]: 'Frustration (Nagsisimula): nangangailangan ng mas matinding suporta ng guro.',
};

const getMaterialUiLanguage = (material: LibraryMaterial): 'eng' | 'fil' => {
  return material.language === 'eng' ? 'eng' : 'fil';
};

const LEVEL_DISPLAY: Record<ComplexityLevel, { primary: string; secondary: string }> = {
  [ComplexityLevel.LITERAL]: { primary: 'Independent', secondary: 'Mahusay' },
  [ComplexityLevel.INFERENTIAL]: { primary: 'Instructional', secondary: 'Papaunlad' },
  [ComplexityLevel.EVALUATIVE]: { primary: 'Frustration', secondary: 'Nagsisimula' },
};

function getLevelDisplay(level: ComplexityLevel, uiLang: 'eng' | 'fil' = 'eng'): string {
  const mapped = LEVEL_DISPLAY[level] ?? LEVEL_DISPLAY[ComplexityLevel.LITERAL];
  return uiLang === 'eng' ? mapped.primary : mapped.secondary;
}

function getLevelLabel(level: ComplexityLevel, uiLang: 'eng' | 'fil' = 'eng'): string {
  const mapped = LEVEL_DISPLAY[level] ?? LEVEL_DISPLAY[ComplexityLevel.LITERAL];
  return uiLang === 'eng' ? mapped.primary : mapped.secondary;
}

function getLevelDesc(level: ComplexityLevel, uiLang: 'eng' | 'fil' = 'eng'): string {
  if (uiLang === 'eng') {
    if (level === ComplexityLevel.LITERAL) return 'Easy — G7 Readable';
    if (level === ComplexityLevel.INFERENTIAL) return 'Moderate — G7 Borderline';
    return 'Difficult — Above G7';
  }
  if (level === ComplexityLevel.LITERAL) return 'Madali — Akma sa G7';
  if (level === ComplexityLevel.INFERENTIAL) return 'Katamtaman — Hangganan ng G7';
  return 'Mahirap — Higit sa G7';
}

const ADVANCED_METRIC_HELP: Record<string, string> = {
  'Complexity Score': 'Model score for how difficult the passage is. Higher values mean the text is more complex and usually needs more support.',
  'Readability Score': 'A readability measure used by the system. Higher values usually mean the passage is easier to read.',
  'Est. Reading Time': 'Estimated time for an average reader to finish the passage.',
  'Avg Sentence Len': 'Average number of words per sentence. Longer sentences often make text harder to read.',
  'Flesch-Kincaid Grade': 'Estimated U.S. grade level of the text. Higher grades mean harder reading.',
  'Gunning Fog Index': 'Estimated grade level based on sentence length and complex words. Higher values mean harder text.',
};

const PHIL_IRI_HELP = 'Phil-IRI stands for Philippine Informal Reading Inventory. In ReadTrack, level labels use: Independent (Mahusay), Instructional (Papaunlad), and Frustration (Nagsisimula).';

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

function parseReasoning(reasoning: string | undefined, level: ComplexityLevel, uiLang: 'eng' | 'fil' = 'eng'): ReasoningResult {
  const summaries = uiLang === 'eng' ? REASONING_SUMMARIES : REASONING_SUMMARIES_FIL;
  const summary = summaries[level] ?? summaries[ComplexityLevel.LITERAL];
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
  const uiLang = getMaterialUiLanguage(material);
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
  const levelLabel = getLevelLabel(material.complexityResult.level, uiLang);
  const cr = material.complexityResult;
  const levelDescriptions = uiLang === 'eng' ? LEVEL_DESCRIPTIONS : LEVEL_DESCRIPTIONS_FIL;
  const { summary: reasoningSummary, tags: reasoningTags } = parseReasoning(
    cr.reasoning, material.complexityResult.level, uiLang
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
                {levelLabel}
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
              {tab === 'original'
                ? (uiLang === 'eng' ? 'Original Submission' : 'Orihinal na Isinumite')
                : (uiLang === 'eng' ? 'Analysis' : 'Pagsusuri')}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          {/* Original Submission Tab */}
          {activeTab === 'original' && (
            <div>
              <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4 flex items-center gap-2">
                <IoBookOutline /> {uiLang === 'eng' ? 'Original File' : 'Orihinal na File'}
              </h4>
              {(allImages.length > 0 || material.originalFile) ? (
                <div className="flex gap-4">
                  {/* Left: original file(s) */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase mb-2">
                      {uiLang === 'eng' ? `Original File${allImages.length > 1 ? `s (${allImages.length})` : ''}` : `Orihinal na File${allImages.length > 1 ? ` (${allImages.length})` : ''}`}
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
                    <p className="text-[10px] font-semibold text-gray-400 uppercase mb-2">{uiLang === 'eng' ? 'Extracted Text' : 'Nakuha na Teksto'}</p>
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
                        {isSavingText ? (uiLang === 'eng' ? 'Saving…' : 'Sine-save…') : (uiLang === 'eng' ? 'Save Text' : 'I-save ang Teksto')}
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
                  <p className="text-[10px] font-semibold text-gray-400 uppercase mb-2">{uiLang === 'eng' ? 'Extracted Text' : 'Nakuha na Teksto'}</p>
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
                      {isSavingText ? (uiLang === 'eng' ? 'Saving…' : 'Sine-save…') : (uiLang === 'eng' ? 'Save Text' : 'I-save ang Teksto')}
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
                  {uiLang === 'eng' ? 'Teacher Verification (Improves Model Reliability)' : 'Beripikasyon ng Guro (Pinapabuti ang pagiging maaasahan ng modelo)'}
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
                      {getLevelDisplay(level, uiLang)}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-teal-700 mb-2">{levelDescriptions[teacherLevel]}</p>
                <textarea
                  value={verificationComment}
                  onChange={e => setVerificationComment(e.target.value)}
                  placeholder={uiLang === 'eng' ? 'Optional note on why this level is correct' : 'Opsyonal na tala kung bakit tama ang level na ito'}
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
                    {isSavingVerification
                      ? (uiLang === 'eng' ? 'Saving…' : 'Sine-save…')
                      : (uiLang === 'eng' ? 'Save & Improve Model' : 'I-save at Pagbutihin ang Modelo')}
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
                    <p className="text-[11px] mt-0.5 opacity-80">{uiLang === 'eng' ? 'Click the i beside any label to see what it means.' : 'I-click ang i sa tabi ng label para makita ang paliwanag.'}</p>
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
                  {uiLang === 'eng' ? `Why is this ${levelLabel}?` : `Bakit ito ${levelLabel}?`}
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
  const uiLang = getMaterialUiLanguage(material);
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
            <h3 className="text-lg font-black text-gray-900">{uiLang === 'eng' ? 'Confirm Material Level' : 'Kumpirmahin ang Antas ng Materyal'}</h3>
            <p className="text-xs text-gray-500 mt-1">
              {uiLang === 'eng' ? 'Model predicted:' : 'Prediksyon ng modelo:'} <span className="font-semibold">{getLevelDisplay(material.complexityResult.level, uiLang)}</span>
            </p>
            <div className="mt-3">
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">{uiLang === 'eng' ? 'Material Title' : 'Pamagat ng Materyal'}</label>
              <input
                type="text"
                value={materialName}
                onChange={(e) => onChangeName(e.target.value)}
                placeholder={uiLang === 'eng' ? 'Enter material title' : 'Ilagay ang pamagat ng materyal'}
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
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">{uiLang === 'eng' ? 'Original File' : 'Orihinal na File'}</p>
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
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">{uiLang === 'eng' ? 'Extracted Text' : 'Nakuha na Teksto'}</p>
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
            {uiLang === 'eng' ? 'Cancel' : 'Kanselahin'}
          </button>
          <button
            onClick={onContinue}
            className="px-5 py-2 text-xs font-black rounded-xl bg-teal-600 text-white hover:bg-teal-700 transition-colors"
          >
            {uiLang === 'eng' ? 'Save & Continue' : 'I-save at Magpatuloy'}
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
  const uiLang = getMaterialUiLanguage(material);
  const predicted = material.complexityResult.level;
  const isManualChoice = selectedLevel !== predicted;
  const [decisionMode, setDecisionMode] = useState<'confirm' | 'manual'>('confirm');
  const [previewOpen, setPreviewOpen] = useState(false);
  const predMeta = levelMeta[predicted] ?? levelMeta[ComplexityLevel.LITERAL];
  const selMeta = levelMeta[selectedLevel] ?? levelMeta[ComplexityLevel.LITERAL];
  const levelDescriptions = uiLang === 'eng' ? LEVEL_DESCRIPTIONS : LEVEL_DESCRIPTIONS_FIL;
  const { summary: reasoningSummary } = parseReasoning(material.complexityResult.reasoning, predicted, uiLang);

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
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">{uiLang === 'eng' ? 'New Material' : 'Bagong Materyal'}</p>
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
                  {uiLang === 'eng' ? 'Model Recommendation' : 'Rekomendasyon ng Modelo'}
                </p>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${predMeta.dot}`} />
                  <span className={`text-xl font-black ${predMeta.text}`}>{getLevelDisplay(predicted, uiLang)}</span>
                </div>
                <p className={`text-[11px] leading-relaxed ${predMeta.text} opacity-80`}>{reasoningSummary}</p>
              </div>
            </div>
          </div>

          {/* Teacher decision */}
          <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 space-y-3">
            <div>
              <p className="text-sm font-bold text-gray-800">{uiLang === 'eng' ? 'Is this recommendation correct?' : 'Tama ba ang rekomendasyong ito?'}</p>
              <p className="text-[11px] text-gray-500 mt-1">{uiLang === 'eng' ? 'Keep the model suggestion, or choose a different level manually.' : 'Panatilihin ang mungkahi ng modelo, o pumili ng ibang antas nang manu-mano.'}</p>
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
                {uiLang === 'eng' ? `Keep ${getLevelDisplay(predicted, uiLang)}` : `Panatilihin ang ${getLevelDisplay(predicted, uiLang)}`}
              </button>
              <button
                onClick={() => setDecisionMode('manual')}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 font-bold text-sm transition-all ${
                  decisionMode === 'manual'
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                {uiLang === 'eng' ? 'Choose manually' : 'Manu-manong pumili'}
              </button>
            </div>

            {decisionMode === 'manual' && (
              <div className="pt-1 space-y-2 animate-in slide-in-from-top-2 duration-150">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">{uiLang === 'eng' ? 'Select the manual level:' : 'Piliin ang manu-manong antas:'}</p>
                <select
                  value={selectedLevel}
                  onChange={(e) => onSelectLevel(e.target.value as ComplexityLevel)}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-indigo-400"
                >
                  {(Object.values(ComplexityLevel) as ComplexityLevel[]).map(level => (
                    <option key={level} value={level}>{getLevelDisplay(level, uiLang)}</option>
                  ))}
                </select>
                <p className={`text-[11px] font-medium ${selMeta.text}`}>{levelDescriptions[selectedLevel]}</p>
              </div>
            )}
          </div>

          {/* Final level indicator when manually adjusted */}
          {isManualChoice && (
            <div className={`rounded-xl border px-4 py-2.5 flex items-center gap-2 ${selMeta.bg} ${selMeta.border}`}>
              <span className={`w-2 h-2 rounded-full shrink-0 ${selMeta.dot}`} />
              <span className={`text-[11px] font-bold ${selMeta.text}`}>
                {uiLang === 'eng' ? 'Will be saved as:' : 'Ise-save bilang:'} <span className="font-black">{getLevelDisplay(selectedLevel, uiLang)}</span>
              </span>
            </div>
          )}

          {/* Optional comment */}
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">
              {uiLang === 'eng' ? 'Note' : 'Tala'} <span className="normal-case font-normal">{uiLang === 'eng' ? '(optional)' : '(opsyonal)'}</span>
            </p>
            <textarea
              value={comment}
              onChange={e => onChangeComment(e.target.value)}
              placeholder={uiLang === 'eng' ? 'e.g. Grade 7 Section Rizal uses this for instructional practice' : 'hal. Ginagamit ito ng Grade 7 Section Rizal para sa instructional na pagsasanay'}
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
              {previewOpen
                ? (uiLang === 'eng' ? 'Hide' : 'Itago')
                : (uiLang === 'eng' ? 'Show' : 'Ipakita')} {uiLang === 'eng' ? 'extracted text' : 'nakuha na teksto'} ({material.text.split(/\s+/).length} {uiLang === 'eng' ? 'words' : 'salita'})
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
            {uiLang === 'eng' ? 'Cancel' : 'Kanselahin'}
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
            {saving
              ? (uiLang === 'eng' ? 'Saving…' : 'Sine-save…')
              : isManualChoice
                ? (uiLang === 'eng' ? `Save as ${getLevelDisplay(selectedLevel, uiLang)}` : `I-save bilang ${getLevelDisplay(selectedLevel, uiLang)}`)
                : (uiLang === 'eng' ? `Keep ${getLevelDisplay(predicted, uiLang)} & Save` : `Panatilihin ang ${getLevelDisplay(predicted, uiLang)} at I-save`)}
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
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showPhilIriHelp, setShowPhilIriHelp] = useState(false);
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
            langs = data.map(m => detectLanguageClientSide(m.text));
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
        langs = data.map(m => detectLanguageClientSide(m.text));
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
    // Fire-and-forget retrain — backend updates model without blocking the UI
    triggerRetrainAPI('en').catch(() => {});
    triggerRetrainAPI('tl').catch(() => {});
  };

  const handleVerifyMaterial = async (material: LibraryMaterial, level: ComplexityLevel, comment: string) => {
    const saveRes = await saveMaterialTeacherVerification(material.id, { level, comment }, material.complexityResult);
    if (saveRes.error) {
      return { ok: false, message: `Could not save verification: ${saveRes.error}` };
    }

    const message = 'Teacher verification saved.';
    const ok = true;
    // Fire-and-forget — training runs in background, never blocks or errors the UI
    addTrainingSampleAPI(material.text, toPhilIriLabel(level)).catch(() => {});

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
    });

    if (error) {
      setUploadError(`Database error: ${error}`);
    } else {
      // Fire-and-forget — training runs in background, never blocks or errors the UI
      addTrainingSampleAPI(material.text, toPhilIriLabel(uploadModalLevel)).catch(() => {});
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
        originalFile: base64 ? { base64, mimeType, name: file.name } : undefined,
      };
      // Detect language for the new material
      let detectedLang: 'eng' | 'fil' = detectLanguageClientSide(extractedText);
      try {
        detectedLang = await detectLanguageAPI(extractedText);
      } catch {
        // detectLanguageAPI is fail-safe; client-side heuristic already set above
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
  }, []);

  const processStagedImages = useCallback(async () => {
    if (stagedImages.length === 0) return;
    setUploading(true);
    setUploadError(null);
    try {
      // OCR all images in order, concatenate text
      let combinedText = '';
      for (const img of stagedImages) {
        const ocrResult = await extractTextFromImageAPI(img.base64, img.mimeType);
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

      let detectedLang: 'eng' | 'fil' = detectLanguageClientSide(extractedText);
      try { detectedLang = await detectLanguageAPI(extractedText); } catch { /* keep fallback */ }

      const material: LibraryMaterial = {
        id: Date.now().toString(),
        name: autoTitle,
        text: extractedText,
        uploadedAt: new Date(),
        complexityResult: result,
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
  }, [stagedImages]);

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
                    <span className="font-semibold">Mahusay</span> = Independent.{' '}
                    <span className="font-semibold">Papaunlad</span> = Instructional.{' '}
                    <span className="font-semibold">Nagsisimula</span> = Frustration.
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
            <button
              type="button"
              onClick={() => setShowPhilIriHelp(v => !v)}
              className="flex items-center gap-1 text-left text-[10px] font-bold uppercase tracking-wider text-blue-600 mb-1"
              aria-expanded={showPhilIriHelp}
              aria-controls="phil-iri-help-main"
            >
              <span>Grade 7 Readability Check (Philippines DepEd)</span>
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-white/80 border border-blue-200">
                <IoInformationCircleOutline className="text-[11px]" />
              </span>
            </button>
            {showPhilIriHelp ? (
              <p id="phil-iri-help-main" className="text-xs text-blue-700 leading-relaxed">
                {PHIL_IRI_HELP}
              </p>
            ) : (
              <p className="text-xs text-blue-700 leading-relaxed">
                <span className="font-semibold">Mahusay</span> = Independent.{' '}
                <span className="font-semibold">Papaunlad</span> = Instructional.{' '}
                <span className="font-semibold">Nagsisimula</span> = Frustration.
              </p>
            )}
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
              { key: ComplexityLevel.LITERAL, label: getLevelDisplay(ComplexityLevel.LITERAL, 'eng'), meta: levelMeta[ComplexityLevel.LITERAL] },
              { key: ComplexityLevel.INFERENTIAL, label: getLevelDisplay(ComplexityLevel.INFERENTIAL, 'eng'), meta: levelMeta[ComplexityLevel.INFERENTIAL] },
              { key: ComplexityLevel.EVALUATIVE, label: getLevelDisplay(ComplexityLevel.EVALUATIVE, 'eng'), meta: levelMeta[ComplexityLevel.EVALUATIVE] },
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
                const cardUiLang = getMaterialUiLanguage(mat);
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
                            {getLevelLabel(mat.complexityResult.level, cardUiLang)}
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
                      {getLevelDesc(mat.complexityResult.level, cardUiLang)}
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
