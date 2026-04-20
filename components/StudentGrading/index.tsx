import React, { useState, useMemo, useCallback, useEffect } from 'react';


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

import { ProficiencyLevel, CachedAnalysis, StudentDiagnosisResult, DepEdRubricScore, OriginalFile } from '../../types';
import { IoRefreshOutline } from 'react-icons/io5';
import { analyzeStudentWorkAPI, classifyTextComplexityAPI, evaluateDepEdRubricAPI, analyzeAllAPI, getTrainStatusAPI, triggerRetrainAPI, TrainStatusResponse } from '../../services/pythonService';
import { saveStudentGradingUpload, saveTeacherRubricScores, lookupEssayIdByText, deleteStudentUpload, deleteStudentAllUploads, updateStudentEssayText, updateStudentUploadAnalysis, deleteSection as deleteSectionRemote, uploadOriginalFilesToStorage } from '../../services/supabaseService';

interface StudentGradingProps {
  onMenuClick?: () => void;
  onSaveAnalysis?: (analysis: CachedAnalysis) => void;
  onDataChanged?: () => void;
  selectedAnalysis?: CachedAnalysis | null;
}

export const StudentGrading: React.FC<StudentGradingProps> = ({
  onMenuClick, onSaveAnalysis, onDataChanged, selectedAnalysis,
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
  const [sortKey, setSortKey] = useState<'newest' | 'oldest' | 'name' | 'essays' | 'level' | 'rating'>('newest');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSubjectManager, setShowSubjectManager] = useState(false);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadPrefilledText, setUploadPrefilledText] = useState<string | undefined>();
  const [showMigration, setShowMigration] = useState(() => needsMigration(initialStudents));
  const [showPerformance, setShowPerformance] = useState(false);
  const [pendingSectionDelete, setPendingSectionDelete] = useState<{
    id: string;
    name: string;
    studentCount: number;
    essayCount: number;
  } | null>(null);
  const [isDeletingSection, setIsDeletingSection] = useState(false);
  const [sectionDeleteNotice, setSectionDeleteNotice] = useState<string | null>(null);

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
  const isUuid = useCallback((value: string) => {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  }, []);

  const updateEssayInState = useCallback((essayId: string, updater: (essay: StudentEssay) => StudentEssay): void => {
    setStudents(prev => {
      const updated = prev.map(s => ({
        ...s,
        essays: s.essays.map(e => (e.id === essayId ? updater(e) : e)),
      }));
      saveStudents(updated);
      return updated;
    });
  }, []);

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
    const targetSection = sections.find(s => s.id === id);
    const name = targetSection?.name ?? 'this section';
    const studentsInSection = students.filter(s => s.sectionId === id);
    const essayIds = studentsInSection.flatMap(s => s.essays.map(e => e.id));

    setPendingSectionDelete({
      id,
      name,
      studentCount: studentsInSection.length,
      essayCount: essayIds.length,
    });
  };

  const confirmDeleteSection = async () => {
    if (!pendingSectionDelete || isDeletingSection) return;

    const { id, name } = pendingSectionDelete;
    const targetSection = sections.find(s => s.id === id);
    const studentsInSection = students.filter(s => s.sectionId === id);
    const essayIds = studentsInSection.flatMap(s => s.essays.map(e => e.id));

    setIsDeletingSection(true);
    setSectionDeleteNotice(null);
    try {
      const nextSections = sections.filter(s => s.id !== id);
      const nextStudents = students.filter(s => s.sectionId !== id);

      updateSections(nextSections);
      updateStudents(nextStudents);

      if (selectedSectionId === id) {
        setSelectedSectionId(nextSections[0]?.id ?? '');
        setSelectedStudentId(null);
        setSelectedEssayId(null);
      } else if (selectedStudentId && studentsInSection.some(s => s.id === selectedStudentId)) {
        setSelectedStudentId(null);
        setSelectedEssayId(null);
      }

      const remoteEssayIds = essayIds.filter(isUuid);
      const remoteErrors: string[] = [];

      if (remoteEssayIds.length > 0) {
        const deleteResults = await Promise.all(
          remoteEssayIds.map(async essayId => {
            const { error } = await deleteStudentUpload(essayId);
            return { essayId, error };
          })
        );

        deleteResults.forEach((result) => {
          if (result.error) {
            remoteErrors.push(`Essay ${result.essayId}: ${result.error}`);
          }
        });
      }

      if (targetSection?.name) {
        const { error } = await deleteSectionRemote(targetSection.name);
        if (error) {
          remoteErrors.push(`Section ${targetSection.name}: ${error}`);
        }
      }

      if (remoteErrors.length > 0) {
        console.error('Section cascade delete completed with remote errors:', remoteErrors);
        setSectionDeleteNotice(`"${name}" was deleted, but some cloud records failed to delete. Please refresh and retry if needed.`);
      }
    } catch (err) {
      console.error('Section cascade delete failed:', err);
      setSectionDeleteNotice(`Could not delete "${name}" completely. Please try again.`);
    } finally {
      setPendingSectionDelete(null);
      setIsDeletingSection(false);
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
    // Clear subjectId on essays that referenced this subject
    const updatedStudents = students.map(s => ({
      ...s,
      essays: s.essays.map(e => e.subjectId === id ? { ...e, subjectId: '' } : e),
    }));
    updateStudents(updatedStudents);
    const next = subjects.filter(s => s.id !== id);
    updateSubjects(next);
    if (selectedSubjectId === id)
      setSelectedSubjectId(next[0]?.id ?? '');
  };

  // ── Student actions ───────────────────────────────────
  const handleAddStudent = (name: string) => {
    if (!selectedSectionId) return;
    const student: Student = { id: Date.now().toString(), name, sectionId: selectedSectionId, essays: [] };
    setStudents(prev => {
      const next = [...prev, student];
      saveStudents(next);
      return next;
    });
  };

  const handleAddStudentToSection = (params: { name: string; sectionId: string }): string => {
    const student: Student = {
      id: Date.now().toString(),
      name: params.name,
      sectionId: params.sectionId,
      essays: [],
    };
    setStudents(prev => {
      const next = [...prev, student];
      saveStudents(next);
      return next;
    });
    return student.id;
  };

  const handleMoveStudent = (studentId: string, targetSectionId: string) => {
    updateStudents(students.map(s => s.id === studentId ? { ...s, sectionId: targetSectionId } : s));
    if (selectedStudentId === studentId) { setSelectedStudentId(null); setSelectedEssayId(null); }
  };

  const handleDeleteStudent = (studentId: string) => {
    if (!window.confirm('Sigurado ka bang gusto mong i-delete ang estudyanteng ito at lahat ng kanyang mga essay?')) return;
    const studentToDelete = students.find(s => s.id === studentId);
    const essayIdsToDelete = (studentToDelete?.essays ?? []).map(e => e.id);

    updateStudents(students.filter(s => s.id !== studentId));
    if (selectedStudentId === studentId) { setSelectedStudentId(null); setSelectedEssayId(null); }

    // Delete remote uploads by their actual upload IDs; this works for both local and Supabase-backed students.
    if (essayIdsToDelete.length > 0) {
      Promise.all(essayIdsToDelete.map(id => deleteStudentUpload(id).catch(console.error))).catch(console.error);
    }

    // Keep legacy cleanup path as a best-effort fallback.
    deleteStudentAllUploads(studentId).catch(() => {});
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

  const handleSortChange = (key: 'newest' | 'oldest' | 'name' | 'essays' | 'level' | 'rating') => {
    setSortKey(key);
    if (key === 'newest') setSortDirection('desc');
    else if (key === 'oldest') setSortDirection('asc');
    else setSortDirection('desc');
  };

  const handleSortRequest = (key: 'name' | 'essays' | 'level' | 'rating') => {
    if (sortKey === key) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDirection('desc');
  };

  // ── Essay upload ──────────────────────────────────────
  const handleUpload = (params: {
    studentId: string; subjectId: string; title: string; text: string;
    originalFiles?: OriginalFile[];
  }) => {
    const selectedSubjectForUpload = subjects.find(s => s.id === params.subjectId);
    const tempEssayId = Date.now().toString();
    const essay: StudentEssay = {
      id: tempEssayId,
      title: params.title,
      text: params.text,
      subjectId: params.subjectId,
      uploadedAt: new Date(),
      analysisStatus: 'processing',
      originalFile: params.originalFiles?.[0],
      originalFiles: params.originalFiles,
    };

    const next = students.map(s =>
      s.id === params.studentId
        ? { ...s, essays: [essay, ...s.essays] }
        : s
    );
    updateStudents(next);

    setSelectedStudentId(params.studentId);
    const student = next.find(s => s.id === params.studentId);
    if (student) setSelectedSectionId(student.sectionId);
    setSelectedSubjectId(params.subjectId);
    onDataChanged?.();

    void (async () => {
      let persistedEssayId = tempEssayId;
      try {
        const targetStudent = next.find(s => s.id === params.studentId);
        const sectionName = sections.find(sec => sec.id === targetStudent?.sectionId)?.name;
        // Save to DB immediately — don't wait for storage upload
        const { data, error } = await saveStudentGradingUpload({
          student_name: targetStudent?.name ?? 'Unknown Student',
          essay_title: essay.title,
          essay_text: essay.text,
          proficiency_level: null,
          nat_score: null,
          diagnosis_result: null,
          complexity_result: null,
          section_name: sectionName,
          subject_name: selectedSubjectForUpload?.name,
          subject_language: selectedSubjectForUpload?.language === 'english' ? 'en' : 'tl',
          original_file: null,
        });

        // Upload files to storage in parallel with analysis — patch DB when done
        const rawFiles = essay.originalFiles?.length
          ? essay.originalFiles
          : essay.originalFile ? [essay.originalFile] : [];
        const storageUploadPromise = rawFiles.length
          ? uploadOriginalFilesToStorage(rawFiles, 'essays')
          : Promise.resolve([]);

        if (error) {
          console.error('saveStudentGradingUpload failed:', error);
        }

        let realId: string | null = data?.id ?? null;
        if (!realId) {
          realId = await lookupEssayIdByText(essay.text);
        }

        if (realId) {
          persistedEssayId = realId;
          setStudents(prev => {
            const updated = prev.map(s => ({
              ...s,
              essays: s.essays.map(e => e.id === tempEssayId ? { ...e, id: realId } : e),
            }));
            saveStudents(updated);
            return updated;
          });

          flushPendingRubricSave(tempEssayId, realId).catch(console.error);
        }

        // Run analysis and storage upload concurrently
        const subjectLang = selectedSubjectForUpload?.language ?? 'filipino';
        const [{ student: diagnosisResult, complexity: comp, rubric: rubricScore }, storedFiles] =
          await Promise.all([
            analyzeAllAPI(params.text, subjectLang),
            storageUploadPromise,
          ]);

        const rubricProficiency = (overall: number): ProficiencyLevel =>
          overall >= 3.5 ? ProficiencyLevel.MAHUSAY
          : overall >= 2.5 ? ProficiencyLevel.PAPAUNLAD
          : ProficiencyLevel.NAGSISIMULA;

        const diag: StudentDiagnosisResult = rubricScore
          ? { ...diagnosisResult, rubricScore, proficiency: rubricProficiency(rubricScore.overallScore) }
          : diagnosisResult;

        updateEssayInState(persistedEssayId, existing => ({
          ...existing,
          diagnosisResult: diag,
          complexityResult: comp,
          analysisStatus: 'ready',
          analysisError: undefined,
        }));

        if (isUuid(persistedEssayId)) {
          const storedFile = storedFiles[0] ?? null;
          const { error: updateError } = await updateStudentUploadAnalysis(persistedEssayId, {
            proficiency_level: diag.proficiency,
            nat_score: diag.natScore ?? null,
            diagnosis_result: diag,
            complexity_result: comp,
            original_file: storedFile,
          });
          if (updateError) {
            console.error('updateStudentUploadAnalysis failed:', updateError);
          }
        }

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
        onDataChanged?.();
      } catch (err) {
        console.error('Background analysis failed:', err);
        updateEssayInState(persistedEssayId, existing => ({
          ...existing,
          analysisStatus: 'failed',
          analysisError: 'Analysis failed. Please try uploading again.',
        }));
      }
    })();

    return Promise.resolve();
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
    onDataChanged?.();
    getTrainStatusAPI().then(setTrainStatus).catch(() => {});
  };

  const handleSaveEssayText = async (essayId: string, essayText: string) => {
    const trimmed = essayText.trim();
    if (!trimmed) {
      throw new Error('Essay text cannot be empty.');
    }

    updateStudents(students.map(s => ({
      ...s,
      essays: s.essays.map(e => e.id === essayId ? { ...e, text: trimmed } : e),
    })));

    const { error } = await updateStudentEssayText(essayId, trimmed);
    if (error) {
      throw new Error(error);
    }
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
    const hit = students
      .map(student => {
        const essay = student.essays.find(e => e.id === selectedAnalysis.id);
        return essay ? { student, essay } : null;
      })
      .find(Boolean);

    if (hit) {
      const subjectId = hit.essay.subjectId;
      setSelectedSectionId(hit.student.sectionId);
      setSelectedStudentId(hit.student.id);
      setSelectedSubjectId(subjectId);
      setSelectedEssayId(hit.essay.id);
      setShowUpload(false);
      return;
    }

    // Fallback for entries without a resolvable essay ID.
    setUploadPrefilledText(selectedAnalysis.studentText);
    setShowUpload(true);
  }, [selectedAnalysis, students]);

  // ── Render guards ─────────────────────────────────────
  if (needsSetup) return <SetupScreen onComplete={handleSetupComplete} />;

  if (showPerformance) {
    return <ModelPerformancePage onBack={() => setShowPerformance(false)} />;
  }

  return (
    <div className="flex h-full bg-[#F5F4F0]">
      {showMigration && sections.length > 0 && subjects.length > 0 && (
        <MigrationModal
          students={students}
          sections={sections}
          subjects={subjects}
          onComplete={handleMigrationComplete}
        />
      )}

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
          onUploadEssay={() => setShowUpload(true)}
          onMenuClick={onMenuClick}
          uploadDisabled={showMigration}
          sectionDeleteNotice={sectionDeleteNotice}
          onDismissNotice={() => setSectionDeleteNotice(null)}
        />

        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          {/* Model Confidence Widget */}
          {trainStatus && (
            <div className="flex items-center gap-4 px-4 py-2 bg-white border-b border-gray-100 flex-shrink-0 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Grading Accuracy</span>
                <button
                  onClick={() => setShowPerformance(true)}
                  className="text-[9px] text-teal-600 hover:text-teal-800 font-semibold underline"
                >
                  View details →
                </button>
              </div>
              {(['english', 'filipino'] as const).map(lang => {
                const stat = trainStatus[lang];
                const langLabel = lang === 'english' ? 'EN' : 'FIL';
                const dot = stat.confidence_level === 'Kumpiyansa' || stat.confidence_level === 'Kalibrado'
                  ? 'bg-green-400' : stat.confidence_level === 'Papaunlad' ? 'bg-yellow-400' : 'bg-red-400';
                const confidenceLabel = stat.confidence_level === 'Kumpiyansa' ? 'Accurate'
                  : stat.confidence_level === 'Kalibrado' ? 'Learning'
                  : stat.confidence_level === 'Papaunlad' ? 'Improving'
                  : 'Getting started';
                const tiers = [
                  { max: 5,   label: 'getting started' },
                  { max: 30,  label: 'Learning' },
                  { max: 100, label: 'Accurate' },
                ];
                const tier = tiers.find(t => stat.rated_essays < t.max);
                const pct = tier ? Math.round((stat.rated_essays / tier.max) * 100) : 100;
                return (
                  <div key={lang} className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />
                    <span className="text-[10px] text-gray-600 font-medium">{langLabel} · {confidenceLabel}</span>
                    <span className="text-[9px] text-gray-400">{stat.rated_essays} rated</span>
                    {tier && (
                      <div className="flex items-center gap-1">
                        <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-teal-400 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[8px] text-gray-400">{pct}%</span>
                      </div>
                    )}
                    {stat.new_since_retrain >= 5 && (
                      <button
                        onClick={() => handleRetrain(lang === 'english' ? 'en' : 'tl')}
                        disabled={isRetraining}
                        className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold disabled:opacity-50 transition-colors ${lang === 'english' ? 'bg-blue-50 text-blue-700 hover:bg-blue-100' : 'bg-pink-50 text-pink-700 hover:bg-pink-100'}`}
                      >
                        <IoRefreshOutline className={isRetraining ? 'animate-spin' : ''} />
                        Retrain ({stat.new_since_retrain} new)
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <StudentGrid
            students={students}
            sections={sections}
            selectedSection={selectedSection}
            selectedSubject={selectedSubject}
            selectedStudentId={selectedStudentId}
            proficiencyFilter={proficiencyFilter}
            sortKey={sortKey}
            sortDirection={sortDirection}
            searchQuery={searchQuery}
            onSelectStudent={handleSelectStudent}
            onAddStudent={() => setShowAddStudent(true)}
            onMoveStudent={handleMoveStudent}
            onDeleteStudent={handleDeleteStudent}
            onProficiencyFilter={setProficiencyFilter}
            onSortChange={handleSortChange}
            onSortRequest={handleSortRequest}
            onSearchChange={setSearchQuery}
          />
        </div>

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
          prefilledSectionId={selectedSectionId || undefined}
          prefilledStudentId={selectedStudentId ?? undefined}
          prefilledSubjectId={selectedSubjectId ?? undefined}
          prefilledText={uploadPrefilledText}
          onUpload={handleUpload}
          onAddSection={section => updateSections([...sections, section])}
          onAddSubject={subject => updateSubjects([...subjects, subject])}
          onAddStudent={handleAddStudentToSection}
          onClose={() => { setShowUpload(false); setUploadPrefilledText(undefined); }}
        />
      )}

      {selectedEssay && selectedStudent && selectedEssay.diagnosisResult && (
        <EssayViewerModal
          student={selectedStudent}
          essay={selectedEssay}
          subject={selectedSubject}
          onSaveEvaluation={handleSaveEvaluation}
          onSaveEssayText={handleSaveEssayText}
          onClose={() => setSelectedEssayId(null)}
        />
      )}

      {pendingSectionDelete && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 pt-6 pb-4 border-b border-gray-100">
              <h3 className="text-base font-black text-gray-900">Delete Section</h3>
              <p className="text-xs text-gray-500 mt-1">
                This action cannot be undone.
              </p>
            </div>
            <div className="px-6 py-4 space-y-3">
              <p className="text-sm text-gray-700">
                Delete <span className="font-bold">"{pendingSectionDelete.name}"</span>?
              </p>
              <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                This will also delete {pendingSectionDelete.studentCount} student(s) and {pendingSectionDelete.essayCount} essay(s).
              </p>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-2">
              <button
                onClick={() => setPendingSectionDelete(null)}
                disabled={isDeletingSection}
                className="px-3 py-2 rounded-lg text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteSection}
                disabled={isDeletingSection}
                className="px-3 py-2 rounded-lg text-xs font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
              >
                {isDeletingSection ? 'Deleting...' : 'Delete Section'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
