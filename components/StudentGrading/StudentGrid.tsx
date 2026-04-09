import React from 'react';
import {
  IoAddOutline, IoEllipsisHorizontal, IoStar,
} from 'react-icons/io5';
import { Student, Section, Subject } from './types';
import { ProficiencyLevel } from '../../types';

const proficiencyMeta: Record<string, { badge: string; dot: string }> = {
  [ProficiencyLevel.MAHUSAY]:     { badge: 'bg-green-100 text-green-700',  dot: 'bg-green-500' },
  [ProficiencyLevel.PAPAUNLAD]:   { badge: 'bg-amber-100 text-amber-700',  dot: 'bg-amber-500' },
  [ProficiencyLevel.NAGSISIMULA]: { badge: 'bg-red-100 text-red-700',      dot: 'bg-red-500' },
};

function proficiencyFromOverall(overall: number): ProficiencyLevel {
  if (overall >= 3.5) return ProficiencyLevel.MAHUSAY;
  if (overall >= 2.5) return ProficiencyLevel.PAPAUNLAD;
  return ProficiencyLevel.NAGSISIMULA;
}

interface StudentGridProps {
  students: Student[];
  sections: Section[];
  selectedSection: Section | null;
  selectedSubject: Subject | null;
  selectedStudentId: string | null;
  proficiencyFilter: ProficiencyLevel | 'all';
  sortKey: 'newest' | 'oldest' | 'name' | 'essays';
  searchQuery: string;
  onSelectStudent: (studentId: string) => void;
  onAddStudent: () => void;
  onMoveStudent: (studentId: string, targetSectionId: string) => void;
  onDeleteStudent: (studentId: string) => void;
  onProficiencyFilter: (f: ProficiencyLevel | 'all') => void;
  onSortChange: (key: 'newest' | 'oldest' | 'name' | 'essays') => void;
  onSearchChange: (q: string) => void;
}

export const StudentGrid: React.FC<StudentGridProps> = ({
  students, sections, selectedSection, selectedSubject,
  selectedStudentId, proficiencyFilter, sortKey, searchQuery,
  onSelectStudent, onAddStudent, onMoveStudent, onDeleteStudent,
  onProficiencyFilter, onSortChange, onSearchChange,
}) => {
  const [menuStudentId, setMenuStudentId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!menuStudentId) return;
    const handler = () => setMenuStudentId(null);
    // Use click so menu item onClick handlers can fire before outside-close logic.
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [menuStudentId]);

  const getEssayProficiency = (essay: Student['essays'][number]): ProficiencyLevel | null => {
    if (essay.teacherRubricScores?.overall != null) {
      return proficiencyFromOverall(essay.teacherRubricScores.overall);
    }
    return (essay.diagnosisResult?.proficiency as ProficiencyLevel | undefined) ?? null;
  };

  // Students in current section who have at least one essay in selected subject (or all students if no subject filter)
  const filtered = students
    .filter(s => selectedSection ? s.sectionId === selectedSection.id : true)
    .filter(s => {
      // Hide students with no essays for the selected subject
      const essayCount = selectedSubject
        ? s.essays.filter(e => e.subjectId === selectedSubject.id).length
        : s.essays.length;
      return essayCount > 0;
    })
    .filter(s => {
      if (proficiencyFilter === 'all') return true;
      return s.essays.some(e =>
        (!selectedSubject || e.subjectId === selectedSubject.id) &&
        getEssayProficiency(e) === proficiencyFilter
      );
    })
    .filter(s => {
      if (!searchQuery.trim()) return true;
      return s.name.toLowerCase().includes(searchQuery.toLowerCase());
    });

  const subjectEssayCount = (student: Student) =>
    selectedSubject
      ? student.essays.filter(e => e.subjectId === selectedSubject.id).length
      : student.essays.length;

  const getMaxDate = (s: Student) =>
    s.essays.length ? Math.max(...s.essays.map(e => +new Date(e.uploadedAt))) : 0;
  const getMinDate = (s: Student) =>
    s.essays.length ? Math.min(...s.essays.map(e => +new Date(e.uploadedAt))) : 0;

  const sorted = [...filtered].sort((a, b) => {
    if (sortKey === 'name') return a.name.localeCompare(b.name);
    if (sortKey === 'essays') return subjectEssayCount(b) - subjectEssayCount(a);
    if (sortKey === 'newest') return getMaxDate(b) - getMaxDate(a);
    if (sortKey === 'oldest') return getMinDate(a) - getMinDate(b);
    return 0;
  });

  const avgRating = (student: Student) => {
    const essays = selectedSubject
      ? student.essays.filter(e => e.subjectId === selectedSubject.id)
      : student.essays;
    const rated = essays.filter(e => e.teacherRating && e.teacherRating > 0);
    if (!rated.length) return null;
    return (rated.reduce((s, e) => s + (e.teacherRating ?? 0), 0) / rated.length).toFixed(1);
  };

  const latestProficiency = (student: Student): string | null => {
    const essays = selectedSubject
      ? student.essays.filter(e => e.subjectId === selectedSubject.id)
      : student.essays;
    return essays[0] ? getEssayProficiency(essays[0]) : null;
  };

  const langPill = selectedSubject
    ? <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${selectedSubject.language === 'english' ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600'}`}>
        {selectedSubject.language === 'english' ? '🇺🇸 EN' : '🇵🇭 FIL'}
      </span>
    : null;

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-white flex-shrink-0 gap-2">
        <div className="flex items-center gap-1.5 text-xs min-w-0">
          <span className="font-bold text-gray-800 truncate">{selectedSection?.name ?? 'All'}</span>
          {selectedSubject && <>
            <span className="text-gray-300">›</span>
            <span className="font-bold text-indigo-600 truncate">{selectedSubject.name}</span>
            {langPill}
          </>}
          <span className="text-gray-400 flex-shrink-0">· {sorted.length} students</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <input
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-gray-50 outline-none w-28 focus:ring-2 focus:ring-teal-300"
            placeholder="Search…"
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
          />
          <select
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-gray-50 outline-none"
            value={sortKey}
            onChange={e => onSortChange(e.target.value as any)}
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="name">Name A–Z</option>
            <option value="essays">Most Essays</option>
          </select>
        </div>
      </div>

      {/* Proficiency filters */}
      <div className="flex gap-1.5 px-4 py-2 bg-[#fafbff] border-b border-gray-100 flex-shrink-0 flex-wrap">
        {(['all', ProficiencyLevel.MAHUSAY, ProficiencyLevel.PAPAUNLAD, ProficiencyLevel.NAGSISIMULA] as const).map(f => (
          <button
            key={f}
            onClick={() => onProficiencyFilter(f)}
            className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all ${
              proficiencyFilter === f
                ? f === 'all' ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                  : `${proficiencyMeta[f]?.badge} border-transparent`
                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
            }`}
          >
            {f === 'all' ? 'All (Lahat)' : f === ProficiencyLevel.MAHUSAY ? '🟢 Mahusay' : f === ProficiencyLevel.PAPAUNLAD ? '🟡 Papaunlad' : '🔴 Nagsisimula'}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {sorted.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 text-center">
            <p className="text-sm font-semibold text-gray-400">No students found</p>
            <p className="text-xs text-gray-300 mt-1">Add a student to get started</p>
          </div>
        )}
        <div className="grid grid-cols-3 gap-3">
          {sorted.map(student => {
            const prof = latestProficiency(student);
            const meta = prof ? proficiencyMeta[prof] : null;
            const rating = avgRating(student);
            const essayCount = subjectEssayCount(student);
            const isSelected = selectedStudentId === student.id;
            const isMenuOpen = menuStudentId === student.id;

            return (
              <div key={student.id} className="relative group">
                <button
                  onClick={() => onSelectStudent(student.id)}
                  className={`w-full text-left p-3 border-2 rounded-xl transition-all ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-50 shadow-sm'
                      : 'border-gray-200 bg-white hover:border-indigo-200 hover:shadow-sm'
                  }`}
                >
                  <div className="font-bold text-sm text-gray-900 truncate mb-1">{student.name}</div>
                  <div className="flex items-center gap-2 text-[10px] text-gray-500">
                    <span>{essayCount} essay{essayCount !== 1 ? 's' : ''}</span>
                    {rating && (
                      <span className="flex items-center gap-0.5 text-amber-500 font-bold">
                        <IoStar className="text-[10px]" />{rating}
                      </span>
                    )}
                  </div>
                  {prof && meta && (
                    <div className="mt-2">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${meta.badge}`}>
                        {prof}
                      </span>
                    </div>
                  )}
                </button>

                {/* ⋯ menu */}
                <div className="absolute top-2 right-2">
                  <button
                    onClick={e => { e.stopPropagation(); setMenuStudentId(isMenuOpen ? null : student.id); }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-100 text-gray-400 transition-opacity"
                  >
                    <IoEllipsisHorizontal className="text-sm" />
                  </button>
                  {isMenuOpen && (
                    <div onClick={e => e.stopPropagation()} className="absolute right-0 top-full mt-1 bg-white border border-gray-100 rounded-lg shadow-xl z-20 min-w-[160px] overflow-hidden">
                      <div className="px-3 py-1.5 text-[9px] font-bold text-gray-400 uppercase">Move to Section</div>
                      {sections.filter(sec => sec.id !== student.sectionId).map(sec => (
                        <button
                          key={sec.id}
                          className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 text-gray-700"
                          onClick={() => { onMoveStudent(student.id, sec.id); setMenuStudentId(null); }}
                        >
                          {sec.name}
                        </button>
                      ))}
                      <div className="border-t border-gray-100" />
                      <button
                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-red-50 text-red-600"
                        onClick={() => { onDeleteStudent(student.id); setMenuStudentId(null); }}
                      >
                        Delete Student
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Add Student card */}
          <button
            onClick={onAddStudent}
            className="flex flex-col items-center justify-center p-3 border-2 border-dashed border-gray-200 hover:border-teal-300 hover:text-teal-600 text-gray-300 rounded-xl transition-colors h-full min-h-[90px]"
          >
            <IoAddOutline className="text-xl mb-1" />
            <span className="text-[10px] font-bold">Add Student</span>
          </button>
        </div>
      </div>
    </div>
  );
};
