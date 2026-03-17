import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { IoMenuOutline, IoCloudUploadOutline } from 'react-icons/io5';

import { Section, Subject, Student, StudentEssay } from './types';
import {
  loadSections, saveSections,
  loadSubjects, saveSubjects,
  loadStudents, saveStudents,
  needsMigration,
} from './storage';
import { SetupScreen } from './SetupScreen';
import { MigrationModal } from './MigrationModal';
import { Sidebar } from './Sidebar';
import { StudentGrid } from './StudentGrid';
import { EssayPanel } from './EssayPanel';
import { SubjectManager } from './SubjectManager';
import { AddStudentModal } from './AddStudentModal';
import { UploadModal } from './UploadModal';
import { EssayViewerModal } from './EssayViewerModal';

import { ProficiencyLevel, CachedAnalysis } from '../../types';
import { analyzeStudentWorkAPI, classifyTextComplexityAPI } from '../../services/pythonService';
import { saveStudentGradingUpload, saveTeacherEvaluation } from '../../services/supabaseService';

interface StudentGradingProps {
  onMenuClick?: () => void;
  onSaveAnalysis?: (analysis: CachedAnalysis) => void;
  selectedAnalysis?: CachedAnalysis | null;
}

export const StudentGrading: React.FC<StudentGradingProps> = ({
  onMenuClick, onSaveAnalysis, selectedAnalysis,
}) => {
  // ── Data ──────────────────────────────────────────────
  const [sections, setSections] = useState<Section[]>(loadSections);
  const [subjects, setSubjects] = useState<Subject[]>(loadSubjects);
  const [students, setStudents] = useState<Student[]>(loadStudents);

  // ── Navigation state ──────────────────────────────────
  const [selectedSectionId, setSelectedSectionId] = useState<string>(sections[0]?.id ?? '');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(subjects[0]?.id ?? '');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedEssayId, setSelectedEssayId] = useState<string | null>(null);

  // ── UI state ──────────────────────────────────────────
  const [proficiencyFilter, setProficiencyFilter] = useState<ProficiencyLevel | 'all'>('all');
  const [sortKey, setSortKey] = useState<'newest' | 'oldest' | 'name' | 'essays'>('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSubjectManager, setShowSubjectManager] = useState(false);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showMigration, setShowMigration] = useState(() => needsMigration(loadStudents()));

  // ── Derived ───────────────────────────────────────────
  const needsSetup = sections.length === 0 || subjects.length === 0;
  const selectedSection = useMemo(() => sections.find(s => s.id === selectedSectionId) ?? null, [sections, selectedSectionId]);
  const selectedSubject = useMemo(() => subjects.find(s => s.id === selectedSubjectId) ?? null, [subjects, selectedSubjectId]);
  const selectedStudent = useMemo(() => students.find(s => s.id === selectedStudentId) ?? null, [students, selectedStudentId]);
  const selectedEssay = useMemo(() => selectedStudent?.essays.find(e => e.id === selectedEssayId) ?? null, [selectedStudent, selectedEssayId]);

  // ── Persist helpers ───────────────────────────────────
  const updateSections = useCallback((next: Section[]) => { setSections(next); saveSections(next); }, []);
  const updateSubjects = useCallback((next: Subject[]) => { setSubjects(next); saveSubjects(next); }, []);
  const updateStudents = useCallback((next: Student[]) => { setStudents(next); saveStudents(next); }, []);

  // ── Setup completion ──────────────────────────────────
  const handleSetupComplete = (section: Section, newSubjects: Subject[]) => {
    updateSections([section]);
    updateSubjects(newSubjects);
    setSelectedSectionId(section.id);
    setSelectedSubjectId(newSubjects[0].id);
  };

  // ── Migration completion ───────────────────────────────
  const handleMigrationComplete = (migrated: Student[]) => {
    updateStudents(migrated);
    setShowMigration(false);
  };

  // ── Section actions ───────────────────────────────────
  const handleCreateSection = (name: string) => {
    const section: Section = { id: Date.now().toString(), name };
    const next = [...sections, section];
    updateSections(next);
    setSelectedSectionId(section.id);
    setSelectedSubjectId(subjects[0]?.id ?? '');
    setSelectedStudentId(null);
    setSelectedEssayId(null);
  };

  const handleRenameSection = (id: string, name: string) => {
    updateSections(sections.map(s => s.id === id ? { ...s, name } : s));
  };

  const handleDeleteSection = (id: string) => {
    const name = sections.find(s => s.id === id)?.name ?? 'this section';
    if (!confirm(`Delete "${name}"?`)) return;
    const next = sections.filter(s => s.id !== id);
    updateSections(next);
    if (selectedSectionId === id) {
      setSelectedSectionId(next[0]?.id ?? '');
      setSelectedStudentId(null);
      setSelectedEssayId(null);
    }
  };

  // ── Subject actions ───────────────────────────────────
  const handleAddSubject = (subject: Subject) => {
    updateSubjects([...subjects, subject]);
  };

  const handleRenameSubject = (id: string, name: string) => {
    updateSubjects(subjects.map(s => s.id === id ? { ...s, name } : s));
  };

  const handleDeleteSubject = (id: string) => {
    updateSubjects(subjects.filter(s => s.id !== id));
    if (selectedSubjectId === id) setSelectedSubjectId(subjects.find(s => s.id !== id)?.id ?? '');
  };

  // ── Student actions ───────────────────────────────────
  const handleAddStudent = (name: string) => {
    if (!selectedSectionId) return;
    const student: Student = { id: Date.now().toString(), name, sectionId: selectedSectionId, essays: [] };
    updateStudents([...students, student]);
  };

  const handleMoveStudent = (studentId: string, targetSectionId: string) => {
    updateStudents(students.map(s => s.id === studentId ? { ...s, sectionId: targetSectionId } : s));
    if (selectedStudentId === studentId) { setSelectedStudentId(null); setSelectedEssayId(null); }
  };

  const handleDeleteStudent = (studentId: string) => {
    if (!confirm('Delete this student and all their essays?')) return;
    updateStudents(students.filter(s => s.id !== studentId));
    if (selectedStudentId === studentId) { setSelectedStudentId(null); setSelectedEssayId(null); }
  };

  // ── Navigation actions ────────────────────────────────
  const handleSelectSubject = (sectionId: string, subjectId: string) => {
    setSelectedSectionId(sectionId);
    setSelectedSubjectId(subjectId);
    setSelectedStudentId(null);
    setSelectedEssayId(null);
  };

  const handleSelectStudent = (studentId: string) => {
    setSelectedStudentId(prev => prev === studentId ? null : studentId);
    setSelectedEssayId(null);
  };

  // ── Essay upload ──────────────────────────────────────
  const handleUpload = async (params: {
    studentId: string; subjectId: string; title: string; text: string;
    originalFile?: { base64: string; mimeType: string; name: string };
  }) => {
    const [diag, comp] = await Promise.all([
      analyzeStudentWorkAPI(params.text, params.originalFile?.base64),
      classifyTextComplexityAPI(params.text, params.originalFile?.base64),
    ]);

    const essay: StudentEssay = {
      id: Date.now().toString(),
      title: params.title,
      text: params.text,
      subjectId: params.subjectId,
      uploadedAt: new Date(),
      diagnosisResult: diag,
      complexityResult: comp,
      originalFile: params.originalFile,
    };

    const next = students.map(s =>
      s.id === params.studentId
        ? { ...s, essays: [essay, ...s.essays] }
        : s
    );
    updateStudents(next);

    saveStudentGradingUpload({ studentId: params.studentId, essay } as any).catch(console.error);

    setSelectedStudentId(params.studentId);
    setSelectedEssayId(essay.id);
    const student = next.find(s => s.id === params.studentId);
    if (student) setSelectedSectionId(student.sectionId);
    setSelectedSubjectId(params.subjectId);

    if (onSaveAnalysis) {
      onSaveAnalysis({
        id: essay.id,
        timestamp: essay.uploadedAt,
        title: essay.title,
        studentText: essay.text,
        diagnosisResult: diag,
        complexityResult: comp,
      });
    }
  };

  // ── Teacher evaluation ────────────────────────────────
  const handleSaveEvaluation = async (essayId: string, rating: number, comment: string) => {
    const next = students.map(s => ({
      ...s,
      essays: s.essays.map(e =>
        e.id === essayId ? { ...e, teacherRating: rating, teacherComment: comment } : e
      ),
    }));
    updateStudents(next);
    const student = next.find(s => s.essays.some(e => e.id === essayId));
    if (student) saveTeacherEvaluation({ studentId: student.id, essayId, rating, comment } as any).catch(console.error);
  };

  // ── selectedAnalysis recovery ──────────────────────────
  useEffect(() => {
    if (!selectedAnalysis) return;
    setShowUpload(true);
  }, [selectedAnalysis]);

  // ── Render guards ─────────────────────────────────────
  if (needsSetup) return <SetupScreen onComplete={handleSetupComplete} />;

  return (
    <div className="flex flex-col h-full bg-[#F2F2F7]">
      {showMigration && sections.length > 0 && subjects.length > 0 && (
        <MigrationModal
          students={students}
          sections={sections}
          subjects={subjects}
          onComplete={handleMigrationComplete}
        />
      )}

      <header className="h-14 flex items-center justify-between px-5 border-b border-gray-100 bg-white shadow-sm flex-shrink-0">
        <div className="flex items-center gap-2">
          {onMenuClick && (
            <button onClick={onMenuClick} className="md:hidden text-gray-500 hover:text-gray-700">
              <IoMenuOutline className="text-2xl" />
            </button>
          )}
          <span className="text-sm font-black text-gray-900">
            Student Grading <span className="text-gray-400 font-normal text-xs">(Pagmamarka ng Mag-aaral)</span>
          </span>
          <span className="text-[10px] font-semibold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
            {students.length}
          </span>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-xs font-bold transition-colors"
        >
          <IoCloudUploadOutline className="text-base" />
          Upload Essay
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          sections={sections}
          subjects={subjects}
          students={students}
          selectedSectionId={selectedSectionId}
          selectedSubjectId={selectedSubjectId}
          onSelectSubject={handleSelectSubject}
          onCreateSection={handleCreateSection}
          onRenameSection={handleRenameSection}
          onDeleteSection={handleDeleteSection}
          onManageSubjects={() => setShowSubjectManager(true)}
        />

        <StudentGrid
          students={students}
          sections={sections}
          selectedSection={selectedSection}
          selectedSubject={selectedSubject}
          selectedStudentId={selectedStudentId}
          proficiencyFilter={proficiencyFilter}
          sortKey={sortKey}
          searchQuery={searchQuery}
          onSelectStudent={handleSelectStudent}
          onAddStudent={() => setShowAddStudent(true)}
          onMoveStudent={handleMoveStudent}
          onDeleteStudent={handleDeleteStudent}
          onProficiencyFilter={setProficiencyFilter}
          onSortChange={setSortKey}
          onSearchChange={setSearchQuery}
        />

        <EssayPanel
          student={selectedStudent}
          selectedSubject={selectedSubject}
          selectedEssayId={selectedEssayId}
          onSelectEssay={setSelectedEssayId}
          onUploadEssay={() => setShowUpload(true)}
        />
      </div>

      {showSubjectManager && (
        <SubjectManager
          subjects={subjects}
          students={students}
          onAdd={handleAddSubject}
          onRename={handleRenameSubject}
          onDelete={handleDeleteSubject}
          onClose={() => setShowSubjectManager(false)}
        />
      )}

      {showAddStudent && selectedSection && (
        <AddStudentModal
          section={selectedSection}
          onAdd={handleAddStudent}
          onClose={() => setShowAddStudent(false)}
        />
      )}

      {showUpload && (
        <UploadModal
          students={students}
          sections={sections}
          subjects={subjects}
          prefilledStudentId={selectedStudentId ?? undefined}
          prefilledSubjectId={selectedSubjectId ?? undefined}
          onUpload={handleUpload}
          onClose={() => setShowUpload(false)}
        />
      )}

      {selectedEssay && selectedStudent && (
        <EssayViewerModal
          student={selectedStudent}
          essay={selectedEssay}
          subject={selectedSubject}
          onSaveEvaluation={handleSaveEvaluation}
          onClose={() => setSelectedEssayId(null)}
        />
      )}
    </div>
  );
};
