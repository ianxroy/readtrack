import React, { useState, useRef, useEffect } from 'react';
import { IoCloseOutline, IoCloudUploadOutline, IoChevronUpOutline, IoChevronDownOutline, IoTrashOutline, IoAddOutline } from 'react-icons/io5';
import { Student, Subject, Section } from './types';
import { OriginalFile } from '../../types';
import { extractTextFromImageAPI, ingestReferenceAPI } from '../../services/pythonService';
import mammoth from 'mammoth';

interface UploadModalProps {
  students: Student[];
  sections: Section[];
  subjects: Subject[];
  prefilledStudentId?: string;
  prefilledSubjectId?: string;
  prefilledText?: string;
  onUpload: (params: {
    studentId: string;
    subjectId: string;
    title: string;
    text: string;
    originalFiles?: OriginalFile[];
  }) => Promise<void>;
  onAddSection?: (section: Section) => void;
  onAddSubject?: (subject: Subject) => void;
  onClose: () => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  students, sections, subjects,
  prefilledStudentId, prefilledSubjectId, prefilledText,
  onUpload, onAddSection, onAddSubject, onClose,
}) => {
  const [sectionId, setSectionId] = useState('');
  const [studentId, setStudentId] = useState(prefilledStudentId ?? '');
  const [subjectId, setSubjectId] = useState(prefilledSubjectId ?? '');
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [imageFiles, setImageFiles] = useState<OriginalFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [previewImage, setPreviewImage] = useState<OriginalFile | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const dragIndexRef = useRef<number | null>(null);

  // Inline section creation
  const [showNewSection, setShowNewSection] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');

  // Inline subject creation
  const [showNewSubject, setShowNewSubject] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectLang, setNewSubjectLang] = useState<'english' | 'filipino'>('filipino');

  const handleCreateSection = () => {
    const name = newSectionName.trim();
    if (!name || !onAddSection) return;
    const section: Section = { id: Date.now().toString(), name };
    onAddSection(section);
    setNewSectionName('');
    setShowNewSection(false);
  };

  const handleCreateSubject = () => {
    const name = newSubjectName.trim();
    if (!name || !onAddSubject) return;
    const subject: Subject = { id: Date.now().toString(), name, language: newSubjectLang };
    onAddSubject(subject);
    setSubjectId(subject.id);
    setNewSubjectName('');
    setShowNewSubject(false);
  };

  useEffect(() => { setStudentId(prefilledStudentId ?? ''); }, [prefilledStudentId]);
  useEffect(() => { setSubjectId(prefilledSubjectId ?? ''); }, [prefilledSubjectId]);
  useEffect(() => { if (prefilledText) setText(prefilledText); }, [prefilledText]);

  const canSubmit = !!studentId && !!subjectId && (!!text.trim() || imageFiles.length > 0) && !isUploading && !isExtracting;

  const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  const resolveTitleAndBody = async (extractedText: string, fallbackTitle: string): Promise<{ title: string; bodyText: string }> => {
    let nextTitle = fallbackTitle;
    let nextBodyText = extractedText;
    try {
      const ingestResult = await ingestReferenceAPI({ text: extractedText });
      const candidate = ingestResult?.title?.trim();
      const cleanedText = ingestResult?.text?.trim();
      if (candidate) nextTitle = candidate;
      if (cleanedText) nextBodyText = cleanedText;
    } catch {
      // Keep filename fallback when title extraction is unavailable.
    }
    return { title: nextTitle, bodyText: nextBodyText };
  };

  const handleFile = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) { setError('File exceeds 10MB limit.'); return; }
    setError(null);
    const fallbackTitle = file.name.replace(/\.[^.]+$/, '').trim() || 'Untitled Essay';

    if (file.type === 'text/plain') {
      const reader = new FileReader();
      reader.onload = async e => {
        const extractedText = (e.target?.result as string) || '';
        const { title: nextTitle, bodyText } = await resolveTitleAndBody(extractedText, fallbackTitle);
        setText(bodyText);
        setTitle(prev => prev.trim() || nextTitle);
      };
      reader.readAsText(file);
    } else if (file.type === DOCX_MIME || file.name.toLowerCase().endsWith('.docx')) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        const extracted = result.value.trim();
        if (extracted) {
          const { title: nextTitle, bodyText } = await resolveTitleAndBody(extracted, fallbackTitle);
          setText(bodyText);
          setTitle(prev => prev.trim() || nextTitle);
        } else {
          setError('Could not extract text from this .docx file. Please paste the text manually.');
        }
      } catch {
        setError('Failed to read .docx file. Please paste the text manually.');
      }
    } else {
      // Image or PDF — stage in list; OCR runs when user clicks Done
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        setImageFiles(prev => [...prev, { base64, mimeType: file.type, name: file.name }]);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleScanImages = async () => {
    if (imageFiles.length === 0 || isExtracting) return;
    setIsExtracting(true);
    setError(null);
    setText('');
    for (const img of imageFiles) {
      try {
        const extracted = await extractTextFromImageAPI(img.base64, img.mimeType);
        if ((extracted as any)?.error === 'api_key_invalid') {
          setError('Gemini API key is expired or invalid. Please update the key in .env.local and restart the backend.');
          break;
        } else if ((extracted as any)?.error === 'no_api_key') {
          setError('No Gemini API key configured. Add GEMINI_API_KEY to .env.local and restart the backend.');
          break;
        } else if ((extracted as any)?.error === 'ocr_timeout') {
          setError(`OCR timed out on "${img.name}". Try a smaller file or paste text manually.`);
          break;
        } else if ((extracted as any)?.error === 'ocr_unavailable') {
          setError('OCR service is unavailable because google-generativeai is not installed on the backend.');
          break;
        } else if ((extracted as any)?.error === 'invalid_base64') {
          setError(`Invalid file data for "${img.name}". Please re-upload.`);
          break;
        } else if (extracted?.text) {
          const fallbackTitle = img.name.replace(/\.[^.]+$/, '').trim();
          const { title: nextTitle, bodyText } = await resolveTitleAndBody(extracted.text, fallbackTitle);
          setText(prev => prev.trim() ? prev + '\n\n' + bodyText : bodyText);
          setTitle(prev => prev.trim() || nextTitle);
          if (extracted?.warning) setError(extracted.warning);
        }
      } catch { /* non-fatal per image */ }
    }
    setIsExtracting(false);
  };

  const handleFilesSequentially = async (files: File[]) => {
    for (const file of files) {
      await handleFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) handleFilesSequentially(files);
  };

  const moveUp = (idx: number) => {
    if (idx === 0) return;
    setImageFiles(prev => {
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
  };

  const moveDown = (idx: number) => {
    setImageFiles(prev => {
      if (idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
  };

  const removeImage = (idx: number) => {
    setImageFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const handleDragStart = (idx: number) => {
    dragIndexRef.current = idx;
    setDraggingIndex(idx);
  };
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIndexRef.current === null || dragIndexRef.current === idx) return;
    setDragOverIndex(idx);
  };
  const handleImageDrop = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    const from = dragIndexRef.current;
    if (from !== null && from !== idx) {
      setImageFiles(prev => {
        const next = [...prev];
        const [item] = next.splice(from, 1);
        next.splice(idx, 0, item);
        return next;
      });
    }
    dragIndexRef.current = null;
    setDraggingIndex(null);
    setDragOverIndex(null);
  };
  const handleDragEnd = () => {
    dragIndexRef.current = null;
    setDraggingIndex(null);
    setDragOverIndex(null);
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsUploading(true);
    setError(null);
    try {
      await onUpload({
        studentId,
        subjectId,
        title: title.trim() || 'Untitled Essay',
        text: text.trim(),
        originalFiles: imageFiles.length > 0 ? imageFiles : undefined,
      });
      onClose();
    } catch (e: any) {
      setError(e.message ?? 'Upload failed.');
    } finally {
      setIsUploading(false);
    }
  };

  const studentsBySection = sections.map(sec => ({
    section: sec,
    students: students.filter(s => s.sectionId === sec.id),
  })).filter(g => g.students.length > 0);

  const filteredStudents = sectionId
    ? students.filter(s => s.sectionId === sectionId)
    : students;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="text-base font-black text-gray-900">Grade Essay (Markahan ang Sanaysay)</h2>
            <p className="text-xs text-gray-400 mt-0.5">Upload student work for instant analysis</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 text-gray-400">
            <IoCloseOutline className="text-lg" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* File drop zone */}
          <div
            className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center gap-2 cursor-pointer transition-colors ${
              isDragging ? 'border-teal-400 bg-teal-50' : 'border-gray-200 hover:border-teal-300 bg-gray-50'
            }`}
            onDragEnter={() => setIsDragging(true)}
            onDragOver={e => e.preventDefault()}
            onDragLeave={e => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false);
            }}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
          >
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept=".txt,.pdf,.docx,image/*"
              multiple
              onChange={e => {
                const files = Array.from(e.target.files || []);
                if (files.length > 0) handleFilesSequentially(files);
                e.target.value = '';
              }}
            />
            {isExtracting ? (
              <>
                <div className="w-6 h-6 rounded-full border-2 border-teal-400 border-t-transparent animate-spin" />
                <div className="text-center">
                  <div className="text-xs font-bold text-teal-600">Extracting text…</div>
                  <div className="text-[10px] text-gray-400">OCR via Gemini · up to 25s</div>
                </div>
              </>
            ) : (
              <>
                <IoCloudUploadOutline className={`text-3xl ${isDragging ? 'text-teal-500' : 'text-gray-300'}`} />
                <div className="text-center">
                  <div className="text-xs font-bold text-gray-700">
                    {imageFiles.length > 0 ? 'Click or drag to add more images' : 'Click or drag a file'}
                  </div>
                  <div className="text-[10px] text-gray-400">PDF, Image, TXT, or DOCX · Max 10MB</div>
                </div>
              </>
            )}
          </div>

          {/* Image queue */}
          {imageFiles.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                Images ({imageFiles.length}) — drag to reorder
              </div>
              {imageFiles.map((f, i) => (
                <React.Fragment key={i}>
                  {/* Indicator above: dragging downward into this slot */}
                  {dragOverIndex === i && draggingIndex !== null && draggingIndex > i && (
                    <div className="h-0.5 rounded-full bg-teal-400 mx-1" />
                  )}
                <div
                  draggable
                  onDragStart={() => handleDragStart(i)}
                  onDragOver={e => handleDragOver(e, i)}
                  onDrop={e => handleImageDrop(e, i)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-2 border rounded-xl px-3 py-2 cursor-grab active:cursor-grabbing transition-all ${
                    draggingIndex === i
                      ? 'opacity-40 bg-gray-100 border-gray-300 scale-[0.98]'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <span className="w-5 text-[10px] font-bold text-gray-400 text-center shrink-0">{i + 1}</span>
                  <img
                    src={`data:${f.mimeType};base64,${f.base64}`}
                    alt={f.name}
                    onClick={e => { e.stopPropagation(); setPreviewImage(f); }}
                    className="w-9 h-9 object-cover rounded-lg border border-gray-200 shrink-0 cursor-pointer hover:ring-2 hover:ring-teal-400 transition-all"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    title="Click to preview"
                  />
                  <span
                    onClick={() => setPreviewImage(f)}
                    className="text-xs text-gray-700 flex-1 truncate cursor-pointer hover:text-teal-600"
                    title={f.name}
                  >{f.name}</span>
                  <button
                    onClick={e => { e.stopPropagation(); moveUp(i); }}
                    disabled={i === 0}
                    className="p-1 rounded-lg text-gray-400 hover:text-gray-700 disabled:opacity-25 transition-colors"
                    title="Move up"
                  >
                    <IoChevronUpOutline className="text-sm" />
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); moveDown(i); }}
                    disabled={i === imageFiles.length - 1}
                    className="p-1 rounded-lg text-gray-400 hover:text-gray-700 disabled:opacity-25 transition-colors"
                    title="Move down"
                  >
                    <IoChevronDownOutline className="text-sm" />
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); removeImage(i); }}
                    className="p-1 rounded-lg text-red-400 hover:text-red-600 transition-colors"
                    title="Remove"
                  >
                    <IoTrashOutline className="text-sm" />
                  </button>
                </div>
                  {/* Indicator below: dragging upward into this slot */}
                  {dragOverIndex === i && draggingIndex !== null && draggingIndex < i && (
                    <div className="h-0.5 rounded-full bg-teal-400 mx-1" />
                  )}
                </React.Fragment>
              ))}

              {/* Scan button */}
              <button
                onClick={handleScanImages}
                disabled={isExtracting}
                className="w-full mt-1 py-2 rounded-xl bg-teal-500 hover:bg-teal-600 disabled:bg-gray-100 disabled:text-gray-400 text-white font-black text-xs transition-colors flex items-center justify-center gap-2"
              >
                {isExtracting ? (
                  <><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Scanning…</>
                ) : (
                  `Done — Scan ${imageFiles.length} Image${imageFiles.length > 1 ? 's' : ''}`
                )}
              </button>
            </div>
          )}

          {/* Image preview lightbox */}
          {previewImage && (
            <div
              className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4"
              onClick={() => setPreviewImage(null)}
            >
              <div className="relative max-w-3xl w-full" onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => setPreviewImage(null)}
                  className="absolute -top-10 right-0 text-white/70 hover:text-white"
                >
                  <IoCloseOutline className="text-3xl" />
                </button>
                <img
                  src={`data:${previewImage.mimeType};base64,${previewImage.base64}`}
                  alt={previewImage.name}
                  className="w-full rounded-2xl shadow-2xl"
                />
                <div className="text-center text-white/60 text-xs mt-2">{previewImage.name}</div>
              </div>
            </div>
          )}

          {error && <div className="bg-red-50 text-red-600 text-xs font-bold px-3 py-2 rounded-xl border border-red-100">{error}</div>}

          {/* Section selector */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                Section (Seksyon)
              </label>
              {onAddSection && (
                <button
                  type="button"
                  onClick={() => { setShowNewSection(s => !s); setNewSectionName(''); }}
                  className="text-[10px] font-bold text-teal-500 hover:text-teal-700 flex items-center gap-0.5"
                >
                  <IoAddOutline /> New Section
                </button>
              )}
            </div>
            {showNewSection && (
              <div className="flex gap-2 mb-2">
                <input
                  autoFocus
                  className="flex-1 px-3 py-2 bg-gray-50 border border-teal-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-teal-400"
                  placeholder="Section name…"
                  value={newSectionName}
                  onChange={e => setNewSectionName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleCreateSection(); if (e.key === 'Escape') setShowNewSection(false); }}
                />
                <button
                  onClick={handleCreateSection}
                  disabled={!newSectionName.trim()}
                  className="px-3 py-2 bg-teal-500 hover:bg-teal-600 disabled:bg-gray-100 disabled:text-gray-400 text-white text-xs font-bold rounded-xl transition-colors"
                >Add</button>
              </div>
            )}
            <select
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-teal-400 appearance-none"
              value={sectionId}
              onChange={e => { setSectionId(e.target.value); setStudentId(''); }}
            >
              <option value="">All sections…</option>
              {sections.map(sec => (
                <option key={sec.id} value={sec.id}>{sec.name}</option>
              ))}
            </select>
          </div>

          {/* Student selector */}
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
              Student (Mag-aaral)
            </label>
            <select
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-teal-400 appearance-none"
              value={studentId}
              onChange={e => setStudentId(e.target.value)}
            >
              <option value="">Select student…</option>
              {sectionId
                ? filteredStudents.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))
                : studentsBySection.map(({ section, students: sStudents }) => (
                    <optgroup key={section.id} label={section.name}>
                      {sStudents.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </optgroup>
                  ))
              }
            </select>
          </div>

          {/* Subject selector */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                Subject (Paksa)
              </label>
              {onAddSubject && (
                <button
                  type="button"
                  onClick={() => { setShowNewSubject(s => !s); setNewSubjectName(''); }}
                  className="text-[10px] font-bold text-teal-500 hover:text-teal-700 flex items-center gap-0.5"
                >
                  <IoAddOutline /> New Subject
                </button>
              )}
            </div>
            {showNewSubject && (
              <div className="flex gap-2 mb-2">
                <input
                  autoFocus
                  className="flex-1 px-3 py-2 bg-gray-50 border border-teal-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-teal-400"
                  placeholder="Subject name…"
                  value={newSubjectName}
                  onChange={e => setNewSubjectName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleCreateSubject(); if (e.key === 'Escape') setShowNewSubject(false); }}
                />
                <button
                  onClick={() => setNewSubjectLang(l => l === 'english' ? 'filipino' : 'english')}
                  className="px-2 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-xs font-bold text-gray-600 transition-colors whitespace-nowrap"
                  title="Toggle language"
                >
                  {newSubjectLang === 'english' ? '🇺🇸 EN' : '🇵🇭 FIL'}
                </button>
                <button
                  onClick={handleCreateSubject}
                  disabled={!newSubjectName.trim()}
                  className="px-3 py-2 bg-teal-500 hover:bg-teal-600 disabled:bg-gray-100 disabled:text-gray-400 text-white text-xs font-bold rounded-xl transition-colors"
                >Add</button>
              </div>
            )}
            <select
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-teal-400 appearance-none"
              value={subjectId}
              onChange={e => setSubjectId(e.target.value)}
            >
              <option value="">Select subject…</option>
              {subjects.map(sub => (
                <option key={sub.id} value={sub.id}>
                  {sub.name} ({sub.language === 'english' ? '🇺🇸 EN' : '🇵🇭 FIL'})
                </option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
              Title (Pamagat) — optional
            </label>
            <input
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-teal-400"
              placeholder="e.g. Narrative Essay #1"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </div>

          {/* Text */}
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
              Content (Nilalaman)
            </label>
            <textarea
              className="w-full px-3 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-teal-400 resize-none min-h-[120px]"
              placeholder="Paste essay text here, or upload a file above…"
              value={text}
              onChange={e => setText(e.target.value)}
            />
          </div>
        </div>

        <div className="px-6 pb-6 pt-2 flex-shrink-0">
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-3 rounded-xl bg-teal-500 hover:bg-teal-600 disabled:bg-gray-100 disabled:text-gray-400 text-white font-black text-sm transition-colors flex items-center justify-center gap-2"
          >
            {isUploading ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Analyzing…</>
            ) : 'Analyze & Grade →'}
          </button>
        </div>
      </div>
    </div>
  );
};
