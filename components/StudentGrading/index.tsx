import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { IoMenuOutline, IoCloudUploadOutline } from 'react-icons/io5';

import { Section, Subject, Student, StudentEssay, TeacherRubricScores } from './types';
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
import { ModelPerformancePage } from './ModelPerformancePage';

import { ProficiencyLevel, CachedAnalysis, StudentDiagnosisResult, DepEdRubricScore } from '../../types';
import { analyzeStudentWorkAPI, classifyTextComplexityAPI, evaluateDepEdRubricAPI, getTrainStatusAPI, triggerRetrainAPI, TrainStatusResponse } from '../../services/pythonService';
import { saveStudentGradingUpload, saveTeacherRubricScores, lookupEssayIdByText, deleteStudentUpload, deleteStudentAllUploads } from '../../services/supabaseService';

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

  const initialStudentsRef = React.useRef<Student[] | null>(null);
  if (initialStudentsRef.current === null) {
    initialStudentsRef.current = loadStudents();
  }
  const initialStudents = initialStudentsRef.current;

  const [students, setStudents] = useState<Student[]>(initialStudents);
  const pendingRubricSavesRef = React.useRef<Record<string, TeacherRubricScores>>({});

  const flushPendingRubricSave = useCallback(async (tempEssayId: string, realEssayId: string) => {
    const pending = pendingRubricSavesRef.current[tempEssayId];
    if (!pending) return;

    delete pendingRubricSavesRef.current[tempEssayId];
    const { error } = await saveTeacherRubricScores(realEssayId, pending);
    if (error) {
      console.error('Flushed rubric score save failed:', error, 'id:', realEssayId);
    } else {
      getTrainStatusAPI().then(setTrainStatus).catch(() => {});
    }
  }, []);

  // ── Navigation state ──────────────────────────────────
  const [selectedSectionId, setSelectedSectionId] = useState<string>(sections[0]?.id ?? '');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(subjects[0]?.id ?? '');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedEssayId, setSelectedEssayId] = useState<string | null>(null);

  // ── Train status state ────────────────────────────────
  const [trainStatus, setTrainStatus] = useState<TrainStatusResponse | null>(null);
  const [isRetraining, setIsRetraining] = useState(false);

  // ── UI state ──────────────────────────────────────────
  const [proficiencyFilter, setProficiencyFilter] = useState<ProficiencyLevel | 'all'>('all');
  const [sortKey, setSortKey] = useState<'newest' | 'oldest' | 'name' | 'essays'>('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSubjectManager, setShowSubjectManager] = useState(false);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadPrefilledText, setUploadPrefilledText] = useState<string | undefined>();
  const [showMigration, setShowMigration] = useState(() => needsMigration(initialStudents));
  const [showPerformance, setShowPerformance] = useState(false);

  // ── Derived ───────────────────────────────────────────
  const needsSetup = sections.length === 0 || subjects.length === 0;
  const selectedSection = useMemo(() => sections.find(s => s.id === selectedSectionId) ?? null, [sections, selectedSectionId]);
  const selectedSubject = useMemo(() => subjects.find(s => s.id === selectedSubjectId) ?? null, [subjects, selectedSubjectId]);
  const selectedStudent = useMemo(() => students.find(s => s.id === selectedStudentId) ?? null, [students, selectedStudentId]);
  const selectedEssay = useMemo(
    () => selectedStudent?.essays.find(e => e.id === selectedEssayId && e.subjectId === selectedSubjectId) ?? null,
    [selectedStudent, selectedEssayId, selectedSubjectId]
  );

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
    const hasEssays = students.some(s => s.essays.some(e => e.subjectId === id));
    if (hasEssays) return; // SubjectManager UI already blocks this with an alert
    const next = subjects.filter(s => s.id !== id);
    updateSubjects(next);
    if (selectedSubjectId === id)
      setSelectedSubjectId(next[0]?.id ?? '');
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
    if (!window.confirm('Sigurado ka bang gusto mong i-delete ang estudyanteng ito at lahat ng kanyang mga essay?')) return;
    updateStudents(students.filter(s => s.id !== studentId));
    if (selectedStudentId === studentId) { setSelectedStudentId(null); setSelectedEssayId(null); }
    deleteStudentAllUploads(studentId).catch(console.error);
  };

  const handleDeleteEssay = (essayId: string) => {
    if (!window.confirm('Sigurado ka bang gusto mong i-delete ang essay na ito?')) return;
    updateStudents(students.map(s => ({
      ...s,
      essays: s.essays.filter(e => e.id !== essayId),
    })));
    if (selectedEssayId === essayId) setSelectedEssayId(null);
    deleteStudentUpload(essayId).catch(console.error);
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
    const [diagnosisResult, comp] = await Promise.all([
      analyzeStudentWorkAPI(params.text, params.originalFile?.base64),
      classifyTextComplexityAPI(params.text, params.originalFile?.base64),
    ]);

    // Non-blocking rubric evaluation
    const selectedSubjectForUpload = subjects.find(s => s.id === params.subjectId);
    let rubricScore: DepEdRubricScore | undefined;
    try {
      rubricScore = await evaluateDepEdRubricAPI(
        params.text,
        selectedSubjectForUpload?.language ?? 'filipino',
        'Grade 7'
      );
    } catch (err) {
      console.warn('Rubric evaluation failed (non-blocking):', err);
    }

    const rubricProficiency = (overall: number): ProficiencyLevel =>
      overall >= 3.5 ? ProficiencyLevel.MAHUSAY
      : overall >= 2.5 ? ProficiencyLevel.PAPAUNLAD
      : ProficiencyLevel.NAGSISIMULA;

    const diag: StudentDiagnosisResult = rubricScore
      ? { ...diagnosisResult, rubricScore, proficiency: rubricProficiency(rubricScore.overallScore) }
      : diagnosisResult;

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

    const targetStudent = next.find(s => s.id === params.studentId);
    const sectionName = sections.find(sec => sec.id === targetStudent?.sectionId)?.name;
    let persistedEssayId = essay.id;
    const { data, error } = await saveStudentGradingUpload({
      student_name: targetStudent?.name ?? 'Unknown Student',
      essay_title: essay.title,
      essay_text: essay.text,
      proficiency_level: essay.diagnosisResult?.proficiency,
      nat_score: essay.diagnosisResult?.natScore,
      diagnosis_result: essay.diagnosisResult,
      complexity_result: essay.complexityResult,
      section_name: sectionName,
      subject_name: selectedSubjectForUpload?.name,
      subject_language: selectedSubjectForUpload?.language === 'english' ? 'en' : 'tl',
      original_file: essay.originalFile ?? null,
    });

    if (error) {
      console.error('saveStudentGradingUpload failed:', error);
    }

    let realId: string | null = data?.id ?? null;
    if (!realId) {
      // Fallback: resolve by text in case insert completed but id was not returned.
      realId = await lookupEssayIdByText(essay.text);
    }

    if (realId) {
      persistedEssayId = realId;
      // Replace temp timestamp ID with the real Supabase UUID — persist to localStorage too
      setStudents(prev => {
        const updated = prev.map(s => ({
          ...s,
          essays: s.essays.map(e => e.id === essay.id ? { ...e, id: realId } : e),
        }));
        saveStudents(updated);
        return updated;
      });

      // If teacher saved while ID was still temporary, persist the queued rubric now.
      flushPendingRubricSave(essay.id, realId).catch(console.error);
    }

    setSelectedStudentId(params.studentId);
    setSelectedEssayId(persistedEssayId);
    const student = next.find(s => s.id === params.studentId);
    if (student) setSelectedSectionId(student.sectionId);
    setSelectedSubjectId(params.subjectId);

    if (onSaveAnalysis) {
      onSaveAnalysis({
        id: persistedEssayId,
        timestamp: essay.uploadedAt,
        title: essay.title,
        studentText: essay.text,
        diagnosisResult: diag,
        complexityResult: comp,
      });
    }
  };

  // ── Retrain action ────────────────────────────────────
  const handleRetrain = async (lang: 'en' | 'tl') => {
    setIsRetraining(true);
    try {
      await triggerRetrainAPI(lang);
      const updated = await getTrainStatusAPI();
      setTrainStatus(updated);
    } catch (err) {
      console.error('Retrain failed:', err);
    } finally {
      setIsRetraining(false);
    }
  };

  // ── Teacher evaluation ────────────────────────────────
  const handleSaveEvaluation = async (essayId: string, rubricScores: TeacherRubricScores, comment: string) => {
    const next = students.map(s => ({
      ...s,
      essays: s.essays.map(e =>
        e.id === essayId ? { ...e, teacherRubricScores: rubricScores, teacherComment: comment } : e
      ),
    }));
    updateStudents(next);

    let idToUse = essayId;

    // Temp IDs are pure numeric timestamps (e.g. "1773803885130") — not valid UUIDs.
    // Resolve the real Supabase UUID before attempting the save.
    const isTempId = /^\d+$/.test(essayId);
    if (isTempId) {
      const essayText = students.flatMap(s => s.essays).find(e => e.id === essayId)?.text;
      if (essayText) {
        // If the teacher clicks save immediately after upload, the insert may still be in flight.
        // Retry briefly before giving up to avoid sending an invalid UUID to Supabase.
        let realId: string | null = null;
        for (let attempt = 0; attempt < 3 && !realId; attempt++) {
          realId = await lookupEssayIdByText(essayText);
          if (!realId) {
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        }

        if (realId) {
          idToUse = realId;
          setStudents(prev => {
            const updated = prev.map(s => ({
              ...s,
              essays: s.essays.map(e => e.id === essayId ? { ...e, id: realId } : e),
            }));
            saveStudents(updated);
            return updated;
          });
          setSelectedEssayId(id => id === essayId ? realId : id);
        }
      }

      // UUID still not resolved — the initial INSERT likely failed.
      // Do a full INSERT now with rubric scores included so data reaches Supabase.
      if (!idToUse || /^\d+$/.test(idToUse)) {
        const essayRef = students.flatMap(s => s.essays).find(e => e.id === essayId);
        if (essayRef) {
          const studentRef = students.find(s => s.essays.some(e => e.id === essayId));
          const subjectRef = subjects.find(s => s.id === essayRef.subjectId);
          const sectionRef = sections.find(s => s.id === studentRef?.sectionId);
          const { data: insertData, error: insertError } = await saveStudentGradingUpload({
            student_name: studentRef?.name ?? '',
            essay_title: essayRef.title,
            essay_text: essayRef.text,
            proficiency_level: essayRef.diagnosisResult?.proficiency,
            nat_score: essayRef.diagnosisResult?.natScore ?? null,
            diagnosis_result: essayRef.diagnosisResult,
            complexity_result: essayRef.complexityResult,
            section_name: sectionRef?.name,
            subject_name: subjectRef?.name,
            subject_language: subjectRef?.language === 'english' ? 'en' : 'tl',
            teacher_rubric_scores: rubricScores,
            original_file: essayRef.originalFile ?? null,
          });
          if (insertError) {
            console.error('Fallback INSERT with rubric failed:', insertError);
            throw new Error(insertError);
          }
          if (insertData?.id) {
            const newRealId = insertData.id;
            setStudents(prev => {
              const updated = prev.map(s => ({
                ...s,
                essays: s.essays.map(e => e.id === essayId ? { ...e, id: newRealId } : e),
              }));
              saveStudents(updated);
              return updated;
            });
            setSelectedEssayId(id => id === essayId ? newRealId : id);
          }
        } else {
          throw new Error('Essay data not found; cannot save to Supabase.');
        }
        getTrainStatusAPI().then(setTrainStatus).catch(() => {});
        return;
      }
    }

    const { error } = await saveTeacherRubricScores(idToUse, rubricScores);
    if (error) {
      console.error('saveTeacherRubricScores failed:', error, 'id:', idToUse);
      throw new Error(error);
    }
    getTrainStatusAPI().then(setTrainStatus).catch(() => {});
  };

  // ── Fetch train status on mount ───────────────────────
  useEffect(() => {
    getTrainStatusAPI()
      .then(setTrainStatus)
      .catch(() => {}); // non-blocking — backend may be offline
  }, []);

  // ── selectedAnalysis recovery ──────────────────────────
  useEffect(() => {
    if (!selectedAnalysis) return;
    setUploadPrefilledText(selectedAnalysis.studentText);
    setShowUpload(true);
  }, [selectedAnalysis]);

  // ── Render guards ─────────────────────────────────────
  if (needsSetup) return <SetupScreen onComplete={handleSetupComplete} />;

  if (showPerformance) {
    return <ModelPerformancePage onBack={() => setShowPerformance(false)} />;
  }

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
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowUpload(true)}
            disabled={showMigration}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
              showMigration
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-teal-500 hover:bg-teal-600 text-white'
            }`}
          >
            <IoCloudUploadOutline className="text-base" />
            Upload Essay
          </button>
        </div>
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
          trainStatus={trainStatus}
          isRetraining={isRetraining}
          onRetrain={handleRetrain}
          onShowPerformance={() => setShowPerformance(true)}
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
          onDeleteEssay={handleDeleteEssay}
          trainStatus={trainStatus}
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
          prefilledText={uploadPrefilledText}
          onUpload={handleUpload}
          onClose={() => { setShowUpload(false); setUploadPrefilledText(undefined); }}
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
