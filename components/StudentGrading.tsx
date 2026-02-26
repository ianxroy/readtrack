

import React, { useState, useRef, useMemo } from 'react';
import { 
  IoCloudUploadOutline, 
  IoPersonCircleOutline, 
  IoChevronDownOutline, 
  IoCloseOutline, 
  IoTrashOutline, 
  IoSearchOutline,
  IoStatsChartOutline,
  IoCheckmarkCircleOutline,
  IoAlertCircleOutline,
  IoTimeOutline,
  IoBookOutline
} from 'react-icons/io5';
import { 
  CachedAnalysis, 
  TextComplexityResult, 
  StudentDiagnosisResult, 
  ProficiencyLevel, 
  ComplexityLevel,
  LearningBand,
  PhilIriLevel
} from '../types';
import { analyzeStudentWorkAPI, classifyTextComplexityAPI } from '../services/pythonService';

interface StudentEssay {
  id: string;
  title: string;
  text: string;
  uploadedAt: Date;
  diagnosisResult?: StudentDiagnosisResult;
  complexityResult?: TextComplexityResult;
}

const proficiencyMeta = {
  [ProficiencyLevel.BEGINNING]: { color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100', dot: 'bg-red-500' },
  [ProficiencyLevel.DEVELOPING]: { color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-100', dot: 'bg-orange-500' },
  [ProficiencyLevel.PROFICIENT]: { color: 'text-teal-600', bg: 'bg-teal-50', border: 'border-teal-100', dot: 'bg-teal-500' },
  [ProficiencyLevel.ADVANCED]: { color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100', dot: 'bg-blue-500' },
};

const complexityMeta = {
  [ComplexityLevel.LITERAL]: { color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-100', dot: 'bg-green-500' },
  [ComplexityLevel.INFERENTIAL]: { color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-100', dot: 'bg-orange-500' },
  [ComplexityLevel.EVALUATIVE]: { color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100', dot: 'bg-red-500' },
};

interface Student {
  id: string;
  name: string;
  essays: StudentEssay[];
}

const STORAGE_KEY = 'readtrack_student_essays';

function loadStudents(): Student[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw).map((s: any) => ({ ...s, essays: s.essays.map((e: any) => ({ ...e, uploadedAt: new Date(e.uploadedAt) })) }));
  } catch { return []; }
}

function saveStudents(students: Student[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(students));
}

export const StudentGrading: React.FC = () => {
  const [students, setStudents] = useState<Student[]>(loadStudents());
  const [showUpload, setShowUpload] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [showEssayModal, setShowEssayModal] = useState<{studentId: string, essayId: string} | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragCount = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upload state
  const [uploadText, setUploadText] = useState('');
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadStudent, setUploadStudent] = useState('');
  const [isNewStudent, setIsNewStudent] = useState(false);

  // Filtered students
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students;
    const q = searchQuery.toLowerCase();
    return students.filter(s => 
      s.name.toLowerCase().includes(q) || 
      s.essays.some(e => e.title.toLowerCase().includes(q))
    );
  }, [students, searchQuery]);

  // Handle upload
  const handleUpload = async () => {
    if (!uploadText.trim() || !uploadStudent.trim()) return;
    
    setIsUploading(true);
    try {
      // Run analysis on the current textarea content (uploadText)
      // This ensures any manual edits to OCR text are preserved
      const [diag, comp] = await Promise.all([
        analyzeStudentWorkAPI(uploadText),
        classifyTextComplexityAPI(uploadText)
      ]);

      let student = students.find(s => s.name === uploadStudent);
      let newStudents = [...students];
      if (!student) {
        student = { id: Date.now().toString(), name: uploadStudent, essays: [] };
        newStudents.push(student);
      }
      const essay: StudentEssay = {
        id: Date.now().toString(),
        title: uploadTitle || `Essay ${student.essays.length + 1}`,
        text: diag.analyzed_text || comp.analyzed_text || uploadText,
        uploadedAt: new Date(),
        diagnosisResult: diag,
        complexityResult: comp
      };
      student.essays = [essay, ...student.essays];
      setStudents(newStudents);
      saveStudents(newStudents);
      setShowUpload(false);
      setUploadText('');
      setUploadTitle('');
      setUploadStudent('');
      setIsNewStudent(false);
    } catch (error) {
      console.error("Analysis failed", error);
      alert("Failed to analyze essay. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const processFile = async (file: File) => {
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
      setUploadText(text);
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
      
      setIsUploading(true);
      try {
        // Extract text immediately for preview and editing
        // Pass the correct mimeType to the API
        const result = await classifyTextComplexityAPI('', base64, mimeType);
        if (result.analyzed_text) {
          setUploadText(result.analyzed_text);
        }
      } catch (e: any) {
        setUploadError("Failed to extract text from file.");
      } finally {
        setIsUploading(false);
      }
    } else {
      setUploadError('Unsupported file type. Use TXT, MD, PDF, or image.');
      return;
    }

    setUploadTitle(file.name.replace(/\.[^.]+$/, ''));
  };

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

  const handleDeleteStudent = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this student and all their essays?")) return;
    const updated = students.filter(s => s.id !== id);
    setStudents(updated);
    saveStudents(updated);
  };

  const handleDeleteEssay = (studentId: string, essayId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this essay?")) return;
    const updated = students.map(s => {
      if (s.id === studentId) {
        return { ...s, essays: s.essays.filter(e => e.id !== essayId) };
      }
      return s;
    });
    setStudents(updated);
    saveStudents(updated);
  };

  // Student card click
  const handleStudentClick = (id: string) => {
    setSelectedStudentId(selectedStudentId === id ? null : id);
  };

  // Render
  return (
    <div className="h-full flex flex-col p-6 max-w-7xl mx-auto w-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">Student Grading</h2>
          <p className="text-sm text-gray-500 mt-1">Manage and analyze student essays</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative flex-1 md:w-64">
            <IoSearchOutline className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search students or essays..." 
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all outline-none"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <button className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 shadow-lg shadow-teal-600/20 transition-all font-bold text-sm" onClick={() => setShowUpload(true)}>
            <IoCloudUploadOutline className="text-lg" /> Upload Essay
          </button>
        </div>
      </div>

      {/* Student Cards - MaterialLibrary style */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredStudents.map(student => {
          // Compute average score if available
          const allScores = student.essays.map(e => e.complexityResult?.score).filter(s => typeof s === 'number');
          const avgScore = allScores.length ? (allScores.reduce((a, b) => a + (b as number), 0) / allScores.length).toFixed(1) : 'N/A';
          return (
            <div key={student.id} className={`rounded-2xl border border-gray-100 shadow-sm bg-white hover:shadow-xl transition-all cursor-pointer relative p-0 overflow-hidden group`} onClick={() => handleStudentClick(student.id)}>
              <div className="flex items-center gap-4 px-6 pt-6 pb-2">
                <div className="w-12 h-12 rounded-2xl bg-teal-50 flex items-center justify-center text-teal-600 shrink-0">
                  <IoPersonCircleOutline className="text-3xl" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-lg text-gray-900 truncate group-hover:text-teal-600 transition-colors">{student.name}</div>
                  <div className="text-xs text-gray-500 font-medium">{student.essays.length} essay{student.essays.length !== 1 ? 's' : ''} recorded</div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <button onClick={e => handleDeleteStudent(student.id, e)} className="p-1.5 text-gray-300 hover:text-red-500 transition-colors">
                    <IoTrashOutline />
                  </button>
                  <IoChevronDownOutline className={`text-xl text-gray-400 transition-transform duration-300 ${selectedStudentId === student.id ? 'rotate-180' : ''}`} />
                </div>
              </div>
              <div className="px-6 pb-6">
                {student.essays.length > 0 && (
                  <div className="flex items-center justify-between py-3 border-y border-gray-50 my-3">
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Latest Essay</span>
                      <span className="text-xs text-gray-700 font-medium">{new Date(student.essays[0].uploadedAt).toLocaleDateString()}</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Avg Complexity</span>
                      <span className="text-xs font-bold text-teal-600">{avgScore}</span>
                    </div>
                  </div>
                )}
                <div className="flex gap-2 flex-wrap mt-2">
                  {student.essays.slice(0, 3).map(essay => (
                    <span key={essay.id} className="bg-gray-50 text-gray-600 border border-gray-100 px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer hover:bg-teal-50 hover:text-teal-700 hover:border-teal-100 transition-all" onClick={e => { e.stopPropagation(); setShowEssayModal({studentId: student.id, essayId: essay.id}); }}>
                      {essay.title}
                    </span>
                  ))}
                  {student.essays.length > 3 && <span className="text-[10px] text-gray-400 font-bold pt-1">+{student.essays.length - 3} more</span>}
                </div>
              </div>
              
              {/* Expanded essays */}
              {selectedStudentId === student.id && (
                <div className="bg-gray-50 border-t border-gray-100 px-6 pt-4 pb-5 space-y-2 animate-in slide-in-from-top-2 duration-300">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">History</div>
                  {student.essays.map(essay => (
                    <div key={essay.id} className="group/item p-3 bg-white rounded-xl flex justify-between items-center border border-gray-100 shadow-sm hover:border-teal-200 transition-all">
                      <div className="min-w-0 pr-4">
                        <div className="font-bold text-xs text-gray-800 truncate">{essay.title}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-gray-400">{new Date(essay.uploadedAt).toLocaleDateString()}</span>
                          {essay.diagnosisResult && (
                            <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${proficiencyMeta[essay.diagnosisResult.proficiency]?.bg} ${proficiencyMeta[essay.diagnosisResult.proficiency]?.color}`}>
                              {essay.diagnosisResult.proficiency}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button className="text-teal-600 text-[10px] font-black uppercase tracking-wider hover:bg-teal-50 px-2 py-1 rounded-lg transition-all" onClick={e => { e.stopPropagation(); setShowEssayModal({studentId: student.id, essayId: essay.id}); }}>View</button>
                        <button onClick={e => handleDeleteEssay(student.id, essay.id, e)} className="p-1.5 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover/item:opacity-100">
                          <IoTrashOutline size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[32px] shadow-2xl border border-white/20 w-full max-w-md p-8 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-2 bg-teal-600" />
            <button className="absolute top-5 right-5 text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-full transition-all" onClick={() => setShowUpload(false)}>
              <IoCloseOutline className="text-2xl" />
            </button>
            
            <div className="mb-6">
              <h3 className="text-2xl font-black text-gray-900 tracking-tight">Grade Essay</h3>
              <p className="text-sm text-gray-500 font-medium">Upload student work for instant analysis</p>
            </div>

            <div className="space-y-4">
              {/* File Upload Zone */}
              <div 
                className={`relative border-2 border-dashed rounded-2xl p-6 transition-all flex flex-col items-center justify-center gap-2 group cursor-pointer ${
                  isDragging ? 'border-teal-500 bg-teal-50' : 'border-gray-200 bg-gray-50 hover:border-teal-400 hover:bg-white'
                }`}
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept=".txt,.md,.pdf,image/*" 
                  onChange={handleFileChange} 
                />
                <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-1 transition-transform group-hover:scale-110 ${isDragging ? 'bg-teal-500 text-white' : 'bg-white text-teal-600 shadow-sm'}`}>
                  <IoCloudUploadOutline size={24} />
                </div>
                <div className="text-center">
                  <div className="text-xs font-black text-gray-900">Click or drag essay file</div>
                  <div className="text-[10px] text-gray-400 font-medium">PDF, Image, TXT, or MD (Max 10MB)</div>
                </div>
              </div>

              {uploadError && (
                <div className="bg-red-50 text-red-600 text-[10px] font-bold p-3 rounded-xl border border-red-100 animate-in fade-in slide-in-from-top-1">
                  {uploadError}
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Student</label>
                <div className="flex flex-col gap-2">
                  <div className="relative">
                    <select 
                      className="w-full pl-4 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all appearance-none outline-none font-medium" 
                      value={isNewStudent ? '__new__' : uploadStudent} 
                      onChange={e => { 
                        if (e.target.value === '__new__') { setIsNewStudent(true); setUploadStudent(''); } 
                        else { setIsNewStudent(false); setUploadStudent(e.target.value); } 
                      }}
                    >
                      <option value="">Select an existing student...</option>
                      {students.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                      <option value="__new__">+ Add new student...</option>
                    </select>
                    <IoChevronDownOutline className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                  {isNewStudent && (
                    <input 
                      className="w-full px-4 py-3 bg-teal-50 border border-teal-100 rounded-2xl text-sm focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all outline-none font-medium placeholder:text-teal-300" 
                      placeholder="Enter new student name..." 
                      value={uploadStudent} 
                      onChange={e => setUploadStudent(e.target.value)} 
                      autoFocus
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Title</label>
                <input 
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all outline-none font-medium" 
                  placeholder="e.g., Narrative Essay #1" 
                  value={uploadTitle} 
                  onChange={e => setUploadTitle(e.target.value)} 
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Content</label>
                <textarea 
                  className="w-full px-4 py-4 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all outline-none font-medium min-h-[160px] resize-none" 
                  placeholder="Paste essay text here..." 
                  value={uploadText} 
                  onChange={e => setUploadText(e.target.value)} 
                />
              </div>

              <button 
                className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-xl flex items-center justify-center gap-3 ${
                  isUploading 
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                    : 'bg-teal-600 text-white hover:bg-teal-700 shadow-teal-600/20'
                }`} 
                onClick={handleUpload}
                disabled={isUploading || !uploadText.trim() || !uploadStudent.trim()}
              >
                {isUploading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-500 rounded-full animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <IoCloudUploadOutline className="text-xl" />
                    Submit for Grading
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Essay Modal - MaterialLibrary style */}
      {showEssayModal && (() => {
        const student = students.find(s => s.id === showEssayModal.studentId);
        const essay = student?.essays.find(e => e.id === showEssayModal.essayId);
        if (!student || !essay) return null;
        
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
                      <IoPersonCircleOutline /> {student.name}
                    </div>
                    {dr && (
                      <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${pMeta?.bg} ${pMeta?.color} ${pMeta?.border}`}>
                        {dr.proficiency}
                      </span>
                    )}
                  </div>
                  <h2 className="text-2xl font-black text-gray-900 tracking-tight truncate">{essay.title}</h2>
                  <p className="text-sm text-gray-400 font-medium mt-1">
                    Analyzed on {new Date(essay.uploadedAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <button onClick={() => setShowEssayModal(null)} className="p-3 rounded-2xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all">
                    <IoCloseOutline className="text-2xl" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-8">
                {/* Scoring Grid */}
                {dr && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: 'NAT Predicted', value: dr.natScore, icon: IoStatsChartOutline, meta: pMeta },
                      { label: 'Learning Band', value: dr.learningBand.split(' ')[0], icon: IoCheckmarkCircleOutline, meta: pMeta },
                      { label: 'Phil-IRI', value: dr.philIriLevel, icon: IoBookOutline, meta: pMeta },
                      { label: 'Complexity', value: cr?.score ?? 'N/A', icon: IoTimeOutline, meta: cMeta }
                    ].map((item, idx) => (
                      <div key={idx} className={`p-4 rounded-2xl border ${item.meta?.border || 'border-gray-100'} ${item.meta?.bg || 'bg-gray-50'}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <item.icon className={`text-xs ${item.meta?.color || 'text-gray-400'}`} />
                          <span className={`text-[10px] font-bold uppercase tracking-widest ${item.meta?.color || 'text-gray-400'}`}>{item.label}</span>
                        </div>
                        <div className={`text-xl font-black ${item.meta?.color || 'text-gray-900'}`}>{item.value}</div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Left Column: Metrics & Feedback */}
                  <div className="space-y-6">
                    {dr && (
                      <div className="bg-gray-900 rounded-[24px] p-6 text-white shadow-xl shadow-gray-900/10">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4 flex items-center gap-2">
                          <IoStatsChartOutline className="text-teal-400" /> Performance Metrics
                        </h4>
                        <div className="space-y-4">
                          {[
                            { label: 'Grammar Accuracy', val: dr.metrics.grammarAccuracy },
                            { label: 'Vocabulary Richness', val: dr.metrics.vocabularyRichness },
                            { label: 'Sentence Complexity', val: dr.metrics.sentenceComplexity },
                            { label: 'Structure & Cohesion', val: dr.metrics.structureCohesion }
                          ].map((m, i) => (
                            <div key={i}>
                              <div className="flex justify-between text-xs font-bold mb-1.5">
                                <span>{m.label}</span>
                                <span className="text-teal-400">{m.val}%</span>
                              </div>
                              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                                <div className="h-full bg-teal-500 rounded-full" style={{ width: `${m.val}%` }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {dr?.feedback && (
                      <div className="bg-teal-50 border border-teal-100 rounded-[24px] p-6">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-teal-600 mb-2 flex items-center gap-2">
                          <IoCheckmarkCircleOutline /> Teacher Feedback
                        </h4>
                        <p className="text-xs text-teal-900 leading-relaxed font-medium">{dr.feedback}</p>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Original Text */}
                  <div className="flex flex-col">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3 ml-1 flex items-center gap-2">
                      <IoBookOutline /> Original Submission
                    </h4>
                    <div className="flex-1 bg-gray-50 border border-gray-100 rounded-[24px] p-6 text-xs text-gray-700 leading-relaxed font-mono whitespace-pre-wrap max-h-[400px] overflow-y-auto">
                      {essay.text}
                    </div>
                  </div>
                </div>

                {/* Grammar Issues */}
                {dr?.issues && dr.issues.length > 0 && (
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 ml-1 flex items-center gap-2">
                      <IoAlertCircleOutline className="text-red-500" /> Linguistic Issues Found ({dr.issues.length})
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {dr.issues.map((issue, i) => (
                        <div key={i} className="p-4 bg-white border border-gray-100 rounded-2xl shadow-sm flex items-start gap-3">
                          <div className="w-2 h-2 rounded-full bg-red-400 mt-1.5 shrink-0" />
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[10px] font-black text-red-500 line-through opacity-50">{issue.original}</span>
                              <span className="text-[10px] font-black text-teal-600">→ {issue.suggestion}</span>
                            </div>
                            <p className="text-[10px] text-gray-500 font-medium">{issue.context}</p>
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
      })()}
    </div>
  );
};
