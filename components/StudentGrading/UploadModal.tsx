import React, { useState, useRef, useEffect } from 'react';
import { IoCloseOutline, IoCloudUploadOutline } from 'react-icons/io5';
import { Student, Subject, Section } from './types';
import { extractTextFromImageAPI } from '../../services/pythonService';
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
    originalFile?: { base64: string; mimeType: string; name: string };
  }) => Promise<void>;
  onClose: () => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  students, sections, subjects,
  prefilledStudentId, prefilledSubjectId, prefilledText,
  onUpload, onClose,
}) => {
  const [studentId, setStudentId] = useState(prefilledStudentId ?? '');
  const [subjectId, setSubjectId] = useState(prefilledSubjectId ?? '');
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [originalFile, setOriginalFile] = useState<{ base64: string; mimeType: string; name: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setStudentId(prefilledStudentId ?? ''); }, [prefilledStudentId]);
  useEffect(() => { setSubjectId(prefilledSubjectId ?? ''); }, [prefilledSubjectId]);
  useEffect(() => { if (prefilledText) setText(prefilledText); }, [prefilledText]);

  const canSubmit = !!studentId && !!subjectId && (!!text.trim() || !!originalFile) && !isUploading && !isExtracting;

  const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  const handleFile = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) { setError('File exceeds 10MB limit.'); return; }
    setError(null);

    if (file.type === 'text/plain') {
      const reader = new FileReader();
      reader.onload = e => setText(e.target?.result as string);
      reader.readAsText(file);
    } else if (file.type === DOCX_MIME || file.name.toLowerCase().endsWith('.docx')) {
      // Extract text from .docx client-side using mammoth
      try {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        const extracted = result.value.trim();
        if (extracted) {
          setText(extracted);
          setTitle(prev => prev || file.name.replace(/\.docx$/i, ''));
        } else {
          setError('Could not extract text from this .docx file. Please paste the text manually.');
        }
      } catch {
        setError('Failed to read .docx file. Please paste the text manually.');
      }
    } else {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = (reader.result as string).split(',')[1];
        setOriginalFile({ base64, mimeType: file.type, name: file.name });
        setIsExtracting(true);
        try {
          const extracted = await extractTextFromImageAPI(base64, file.type);
          if ((extracted as any)?.error === 'api_key_invalid') {
            setError('Gemini API key is expired or invalid. Please update the key in .env.local and restart the backend.');
          } else if ((extracted as any)?.error === 'no_api_key') {
            setError('No Gemini API key configured. Add GEMINI_API_KEY to .env.local and restart the backend.');
          } else if ((extracted as any)?.error === 'ocr_timeout') {
            setError('OCR timed out. The file may be too large or the server is slow. Please paste the text manually.');
          } else if ((extracted as any)?.error === 'ocr_unavailable') {
            setError('OCR service is unavailable because google-generativeai is not installed on the backend.');
          } else if ((extracted as any)?.error === 'invalid_base64') {
            setError('Uploaded file data was invalid. Please re-upload the file.');
          } else if (extracted?.text) {
            setText(extracted.text);
            if (extracted?.warning) setError(extracted.warning);
          } else {
            setError('Could not extract text from this file. Please paste the text manually.');
          }
        } catch { /* OCR failure is non-fatal */ }
        finally { setIsExtracting(false); }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsUploading(true);
    setError(null);
    try {
      await onUpload({ studentId, subjectId, title: title.trim() || 'Untitled Essay', text: text.trim(), originalFile: originalFile ?? undefined });
      onClose();
    } catch (e: any) {
      setError(e.message ?? 'Upload failed.');
    } finally {
      setIsUploading(false);
    }
  };

  // Group students by section for the dropdown
  const studentsBySection = sections.map(sec => ({
    section: sec,
    students: students.filter(s => s.sectionId === sec.id),
  })).filter(g => g.students.length > 0);

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
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                setIsDragging(false);
              }
            }}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
          >
            <input ref={fileRef} type="file" className="hidden" accept=".txt,.pdf,.docx,image/*" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
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
                  <div className="text-xs font-bold text-gray-700">{originalFile ? originalFile.name : 'Click or drag a file'}</div>
                  <div className="text-[10px] text-gray-400">PDF, Image, TXT, or DOCX · Max 10MB</div>
                </div>
              </>
            )}
          </div>

          {error && <div className="bg-red-50 text-red-600 text-xs font-bold px-3 py-2 rounded-xl border border-red-100">{error}</div>}

          {/* Student selector grouped by section */}
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
              {studentsBySection.map(({ section, students: sStudents }) => (
                <optgroup key={section.id} label={section.name}>
                  {sStudents.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Subject selector */}
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
              Subject (Paksa)
            </label>
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
