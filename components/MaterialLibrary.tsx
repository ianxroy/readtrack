import React, { useState, useRef, useCallback } from 'react';
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
  IoGridOutline,
} from 'react-icons/io5';
import { LibraryMaterial, TextComplexityResult, ComplexityLevel } from '../types';
import { classifyTextComplexityAPI, extractTextFromImageAPI } from '../services/pythonService';
import { saveMaterialUpload, loadMaterialUploads, deleteMaterialUpload } from '../services/supabaseService';
import { useEffect } from 'react';



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

interface DetailModalProps {
  material: LibraryMaterial;
  onClose: () => void;
  onDelete: (id: string) => void;
  onUpdate: (updated: LibraryMaterial) => void;
}

const DetailModal: React.FC<DetailModalProps> = ({ material, onClose, onDelete, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(material.name);
  const [editedText, setEditedText] = useState(material.text);
  const [viewMode, setViewMode] = useState<'text' | 'sideBySide'>('text');
  
  const meta = levelMeta[material.complexityResult.level] ?? levelMeta[ComplexityLevel.LITERAL];
  const cr = material.complexityResult;

  const handleSave = () => {
    onUpdate({
      ...material,
      name: editedName,
      text: editedText
    });
    setIsEditing(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-gray-100">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${meta.badge}`}>
                {meta.label}
              </span>
              <span className="text-[10px] text-gray-400">{meta.desc}</span>
            </div>
            {isEditing ? (
              <input
                type="text"
                className="w-full text-base font-bold text-gray-800 border-b border-teal-500 outline-none"
                value={editedName}
                onChange={e => setEditedName(e.target.value)}
                autoFocus
              />
            ) : (
              <h2 className="text-base font-bold text-gray-800 truncate">{material.name}</h2>
            )}
            <p className="text-[11px] text-gray-400 mt-0.5">
              Added {new Date(material.uploadedAt).toLocaleDateString()} &middot; {cr.wordCount || 0} words
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isEditing ? (
              <button
                onClick={handleSave}
                className="px-3 py-1.5 bg-teal-600 text-white rounded-lg text-xs font-bold hover:bg-teal-700 transition-colors"
              >
                Save
              </button>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="p-2 rounded-xl text-gray-400 hover:text-teal-500 hover:bg-teal-50 transition-colors"
              >
                <IoBookOutline />
              </button>
            )}
            <button
              onClick={() => { onDelete(material.id); onClose(); }}
              className="p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            >
              <IoTrashOutline />
            </button>
            <button onClick={onClose} className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors">
              <IoCloseOutline />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Complexity summary row */}
          <div className={`mx-5 mt-4 rounded-xl border p-4 ${meta.bg} ${meta.border}`}>
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
            <div className="mx-5 mt-3 grid grid-cols-2 gap-3">
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
          {cr.reasoning && (
            <div className="mx-5 mt-3 bg-teal-50 border border-teal-100 rounded-xl p-4">
              <div className="text-[10px] font-bold uppercase tracking-widest text-teal-500 mb-1.5">Model Reasoning</div>
              <p className="text-xs text-teal-800 leading-relaxed">{cr.reasoning}</p>
            </div>
          )}

          {/* Material text */}
          <div className="mx-5 mt-3 mb-5">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Material Text</div>
              {material.originalFile && material.originalFile.mimeType.startsWith('image/') && !isEditing && (
                <button
                  onClick={() => setViewMode(viewMode === 'sideBySide' ? 'text' : 'sideBySide')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all ${
                    viewMode === 'sideBySide'
                      ? 'bg-teal-100 text-teal-700 border border-teal-200'
                      : 'bg-gray-100 text-gray-500 border border-gray-200 hover:bg-teal-50 hover:text-teal-600'
                  }`}
                >
                  {viewMode === 'sideBySide' ? <IoDocumentTextOutline /> : <IoGridOutline />}
                  {viewMode === 'sideBySide' ? 'Text Only' : 'Compare Original'}
                </button>
              )}
            </div>
            {isEditing ? (
              <textarea
                className="w-full bg-gray-50 border border-gray-100 rounded-xl p-4 text-xs text-gray-700 leading-relaxed font-mono min-h-[200px] outline-none focus:ring-1 focus:ring-teal-500"
                value={editedText}
                onChange={e => setEditedText(e.target.value)}
              />
            ) : viewMode === 'sideBySide' && material.originalFile ? (
              <div className="flex gap-3 max-h-64">
                {/* Original file preview */}
                <div className="flex-1 bg-gray-50 border border-gray-100 rounded-xl p-3 overflow-auto">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2 flex items-center gap-1.5">
                    <IoImageOutline /> Original File
                  </div>
                  {material.originalFile.mimeType.startsWith('image/') ? (
                    <img
                      src={`data:${material.originalFile.mimeType};base64,${material.originalFile.base64}`}
                      alt="Original uploaded file"
                      className="w-full h-auto rounded-lg object-contain"
                    />
                  ) : material.originalFile.mimeType === 'application/pdf' ? (
                    <iframe
                      src={`data:application/pdf;base64,${material.originalFile.base64}`}
                      className="w-full h-full min-h-[200px] rounded-lg"
                      title="Original PDF"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-24 text-gray-400 text-xs">
                      Text file — no visual preview
                    </div>
                  )}
                </div>
                {/* Extracted text */}
                <div className="flex-1 bg-gray-50 border border-gray-100 rounded-xl p-3 overflow-auto">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2 flex items-center gap-1.5">
                    <IoDocumentTextOutline /> Scanned Text
                  </div>
                  <div className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap font-mono">
                    {material.text}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-xs text-gray-700 leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto font-mono">
                {material.text}
              </div>
            )}
          </div>
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
  const [isDragging, setIsDragging] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const dragCount = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    loadMaterialUploads().then(({ data, error }) => {
      if (!cancelled) {
        if (!error) setMaterials(data);
        setMaterialsLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  const refreshMaterials = async () => {
    const { data } = await loadMaterialUploads();
    setMaterials(data);
  };

  const persist = (updated: LibraryMaterial[]) => {
    setMaterials(updated);
  };

  const handleUpdate = (updated: LibraryMaterial) => {
    setMaterials(materials.map(m => m.id === updated.id ? updated : m));
  };

  const handleDelete = async (id: string) => {
    // Optimistic update
    setMaterials((prev) => prev.filter(m => m.id !== id));
    const { error } = await deleteMaterialUpload(id);
    if (error) console.error('Delete material failed:', error);
    // Refresh from DB to stay in sync
    await refreshMaterials();
  };

  const processFile = useCallback(async (file: File) => {
    setUploadError(null);
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
          const { text, warning } = await extractTextFromImageAPI(base64, mimeType);
          warningMessage = warning;
          extractedText = text;
        } catch {
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
      persist([material, ...materials]);

      const { error } = await saveMaterialUpload({
        material_name: material.name,
        material_text: material.text,
        complexity_level: material.complexityResult.level,
        complexity_score: material.complexityResult.score,
        complexity_result: material.complexityResult,
      });

      if (error) {
        setUploadError(`Database error: ${error}`);
      }
      
      await refreshMaterials();
    } catch (e: any) {
      setUploadError(e.message || 'Analysis failed.');
    } finally {
      setUploading(false);
    }
  }, [materials]);

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

  return (
    <div className="flex flex-col h-full bg-[#F2F2F7]">
      {selected && (
        <DetailModal
          material={selected}
          onClose={() => setSelected(null)}
          onDelete={handleDelete}
          onUpdate={handleUpdate}
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
          onClick={() => fileInputRef.current?.click()}
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
          <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-700 leading-relaxed">
            <span className="font-semibold">Complexity</span> measures if a material is readable by Grade 7 students (Literal → easy, Inferential → moderate, Evaluative → difficult).
            This is separate from student essay <span className="font-semibold">Proficiency</span> scoring.
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
          <div className="flex gap-2 flex-wrap">
            {([
              { key: 'all' as const, label: 'All' },
              { key: ComplexityLevel.LITERAL, label: 'Literal' },
              { key: ComplexityLevel.INFERENTIAL, label: 'Inferential' },
              { key: ComplexityLevel.EVALUATIVE, label: 'Evaluative' },
            ]).map(({ key, label }) => {
              const count = counts[key];
              const isActive = filter === key;
              const meta = key !== 'all' ? levelMeta[key] : null;
              return (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                    isActive
                      ? meta ? `${meta.bg} ${meta.text} ${meta.border}` : 'bg-teal-50 text-teal-700 border-teal-200'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {meta && <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />}
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

          {/* Drop zone / empty state */}
          {!materialsLoading && materials.length === 0 && (
            <div
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`flex flex-col items-center justify-center h-60 rounded-2xl border-2 border-dashed cursor-pointer transition-all ${
                isDragging ? 'border-teal-400 bg-teal-50' : 'border-gray-200 bg-white hover:border-teal-300'
              }`}
            >
              <IoCloudUploadOutline className={`text-4xl mb-3 ${isDragging ? 'text-teal-500' : 'text-gray-300'}`} />
              <p className="text-sm font-semibold text-gray-500">{isDragging ? 'Drop to analyze' : 'Upload your first material'}</p>
              <p className="text-xs text-gray-400 mt-1">TXT, MD, PDF, or image — complexity will be measured automatically</p>
            </div>
          )}

          {/* Drop overlay for non-empty library */}
          {materials.length > 0 && (
            <div
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`transition-all rounded-xl border-2 border-dashed text-center text-xs font-medium py-3 cursor-pointer ${
                isDragging
                  ? 'border-teal-400 bg-teal-50 text-teal-600'
                  : 'border-gray-100 text-gray-300 hover:border-gray-200'
              }`}
              onClick={() => fileInputRef.current?.click()}
            >
              {isDragging ? 'Drop to add to library' : '+ Drop a file here or click to upload'}
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
                  <button
                    key={mat.id}
                    onClick={() => setSelected(mat)}
                    className="group text-left bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all relative overflow-hidden"
                  >
                    {/* Level color bar */}
                    <div className={`absolute top-0 left-0 right-0 h-1 rounded-t-2xl ${meta.dot}`} />

                    <div className="flex items-start justify-between gap-2 mb-3 pt-1">
                      <div className="flex-1 min-w-0">
                        <div className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border mb-1.5 ${meta.badge}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                          {meta.label}
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
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
