import React from 'react';
import {
  IoAddOutline, IoEllipsisHorizontal, IoStar, IoSearchOutline,
} from 'react-icons/io5';
import { Student, Section, Subject } from './types';
import { ProficiencyLevel } from '../../types';
import {
  getUILanguagePreference,
  resolveUILanguage,
  subscribeUILanguagePreferenceChange,
} from '../../services/uiSettings';

const PROF_META: Record<string, { pill: string; dot: string; label: string; enLabel: string }> = {
  [ProficiencyLevel.MAHUSAY]:     { pill: 'bg-emerald-50 text-emerald-700 border-emerald-200',  dot: 'bg-emerald-500', label: 'Mahusay',     enLabel: 'Proficient'  },
  [ProficiencyLevel.PAPAUNLAD]:   { pill: 'bg-amber-50 text-amber-700 border-amber-200',        dot: 'bg-amber-400',   label: 'Papaunlad',   enLabel: 'Developing'  },
  [ProficiencyLevel.NAGSISIMULA]: { pill: 'bg-rose-50 text-rose-700 border-rose-200',           dot: 'bg-rose-500',    label: 'Nagsisimula', enLabel: 'Beginning'   },
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
  sortKey: 'newest' | 'oldest' | 'name' | 'essays' | 'level' | 'rating';
  sortDirection: 'asc' | 'desc';
  searchQuery: string;
  onSelectStudent: (studentId: string) => void;
  onAddStudent: () => void;
  onMoveStudent: (studentId: string, targetSectionId: string) => void;
  onDeleteStudent: (studentId: string) => void;
  onProficiencyFilter: (f: ProficiencyLevel | 'all') => void;
  onSortChange: (key: 'newest' | 'oldest' | 'name' | 'essays' | 'level' | 'rating') => void;
  onSortRequest: (key: 'name' | 'essays' | 'level' | 'rating') => void;
  onSearchChange: (q: string) => void;
}

export const StudentGrid: React.FC<StudentGridProps> = ({
  students, sections, selectedSection, selectedSubject,
  selectedStudentId, proficiencyFilter, sortKey, searchQuery,
  sortDirection,
  onSelectStudent, onAddStudent, onMoveStudent, onDeleteStudent,
  onProficiencyFilter, onSortChange, onSortRequest, onSearchChange,
}) => {
  const [menuStudentId, setMenuStudentId] = React.useState<string | null>(null);
  const [uiLanguagePreference, setUiLanguagePreference] = React.useState(getUILanguagePreference());

  React.useEffect(() => {
    if (!menuStudentId) return;
    const handler = () => setMenuStudentId(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [menuStudentId]);

  React.useEffect(() => {
    const unsubscribe = subscribeUILanguagePreferenceChange(() => {
      setUiLanguagePreference(getUILanguagePreference());
    });
    return unsubscribe;
  }, []);

  const automaticLanguage: 'english' | 'filipino' = selectedSubject?.language === 'english' ? 'english' : 'filipino';
  const isEnglish = resolveUILanguage(uiLanguagePreference, automaticLanguage) === 'english';

  const getEssayProf = (essay: Student['essays'][number]): ProficiencyLevel | null => {
    if (essay.teacherRubricScores?.overall != null)
      return proficiencyFromOverall(essay.teacherRubricScores.overall);
    return (essay.diagnosisResult?.proficiency as ProficiencyLevel | undefined) ?? null;
  };

  const subjectEssays = (student: Student) =>
    selectedSubject
      ? student.essays.filter(e => e.subjectId === selectedSubject.id)
      : student.essays;

  const latestProf = (student: Student): ProficiencyLevel | null => {
    const essays = subjectEssays(student);
    return essays[0] ? getEssayProf(essays[0]) : null;
  };

  const levelRank = (student: Student): number => {
    const prof = latestProf(student);
    if (!prof) return 0;
    if (prof === ProficiencyLevel.MAHUSAY) return 3;
    if (prof === ProficiencyLevel.PAPAUNLAD) return 2;
    return 1;
  };

  const getEssayRating = (essay: Student['essays'][number]): number | null => {
    if (essay.teacherRubricScores?.overall != null) return essay.teacherRubricScores.overall;
    if (essay.teacherRating != null && essay.teacherRating > 0) return essay.teacherRating;
    if (essay.diagnosisResult?.rubricScore?.overallScore != null) return essay.diagnosisResult.rubricScore.overallScore;
    return null;
  };

  const avgRating = (student: Student): string | null => {
    const ratings = subjectEssays(student)
      .map(getEssayRating)
      .filter((value): value is number => value != null && value > 0);
    if (!ratings.length) return null;
    return (ratings.reduce((sum, value) => sum + value, 0) / ratings.length).toFixed(1);
  };

  const ratingValue = (student: Student): number => {
    const score = avgRating(student);
    return score ? parseFloat(score) : -1;
  };

  const filtered = students
    .filter(s => selectedSection ? s.sectionId === selectedSection.id : true)
    .filter(s => {
      if (proficiencyFilter === 'all') return true;
      return subjectEssays(s).some(e => getEssayProf(e) === proficiencyFilter);
    })
    .filter(s => !searchQuery.trim() || s.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const getMaxDate = (s: Student) =>
    s.essays.length ? Math.max(...s.essays.map(e => +new Date(e.uploadedAt))) : 0;
  const getMinDate = (s: Student) =>
    s.essays.length ? Math.min(...s.essays.map(e => +new Date(e.uploadedAt))) : 0;

  const sorted = [...filtered].sort((a, b) => {
    if (sortKey === 'newest') return getMaxDate(b) - getMaxDate(a);
    if (sortKey === 'oldest') return getMinDate(a) - getMinDate(b);

    const direction = sortDirection === 'asc' ? 1 : -1;

    if (sortKey === 'name') return a.name.localeCompare(b.name) * direction;
    if (sortKey === 'essays') return (subjectEssays(a).length - subjectEssays(b).length) * direction;
    if (sortKey === 'level') return (levelRank(a) - levelRank(b)) * direction;
    if (sortKey === 'rating') return (ratingValue(a) - ratingValue(b)) * direction;
    return 0;
  });

  const renderSortIndicator = (key: 'name' | 'essays' | 'level' | 'rating') => {
    if (sortKey !== key) return null;
    return <span className="ml-1 text-[9px] text-indigo-500">{sortDirection === 'asc' ? '↑' : '↓'}</span>;
  };

  const profLabel = (level: ProficiencyLevel) =>
    isEnglish ? PROF_META[level]?.enLabel : PROF_META[level]?.label;

  const filterLabel = (f: ProficiencyLevel | 'all') => {
    if (f === 'all') return 'All';
    return profLabel(f) ?? f;
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#F5F4F0]">

      {/* Toolbar */}
      <div className="flex items-center justify-between px-5 py-3 bg-[#F5F4F0] border-b border-gray-200/60 shrink-0 gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-bold text-gray-800 truncate">
            {selectedSection?.name ?? 'Students'}
          </span>
          {selectedSubject && (
            <>
              <span className="text-gray-300 text-xs">›</span>
              <span className="text-xs font-bold text-indigo-600 truncate">{selectedSubject.name}</span>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${
                selectedSubject.language === 'english'
                  ? 'bg-sky-50 text-sky-600 border-sky-200'
                  : 'bg-rose-50 text-rose-600 border-rose-200'
              }`}>
                {selectedSubject.language === 'english' ? 'EN' : 'FIL'}
              </span>
            </>
          )}
          <span className="text-[10px] text-gray-400 shrink-0">· {sorted.length}</span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Search */}
          <div className="relative">
            <IoSearchOutline className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none" />
            <input
              className="text-sm border border-gray-200 rounded-xl pl-8 pr-3 py-2 bg-white outline-none w-36 focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 shadow-sm"
              placeholder="Search…"
              value={searchQuery}
              onChange={e => onSearchChange(e.target.value)}
            />
          </div>
          {/* Sort */}
          <select
            className="text-xs border border-gray-200 rounded-xl px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-indigo-200 shadow-sm"
            value={sortKey}
            onChange={e => onSortChange(e.target.value as any)}
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="name">Name</option>
            <option value="essays">Essays</option>
            <option value="level">Level</option>
            <option value="rating">Rating</option>
          </select>
          {/* Add button */}
          <button
            onClick={onAddStudent}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-semibold transition-colors shadow-sm"
          >
            <IoAddOutline className="text-sm" />
            Add
          </button>
        </div>
      </div>

      {/* Proficiency filter pills */}
      <div className="flex gap-1.5 px-5 py-2 border-b border-gray-200/60 bg-[#F5F4F0] shrink-0">
        {(['all', ProficiencyLevel.MAHUSAY, ProficiencyLevel.PAPAUNLAD, ProficiencyLevel.NAGSISIMULA] as const).map(f => {
          const meta = f !== 'all' ? PROF_META[f] : null;
          const isActive = proficiencyFilter === f;
          return (
            <button
              key={f}
              onClick={() => onProficiencyFilter(f)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all ${
                isActive
                  ? meta ? `${meta.pill} border-transparent` : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                  : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'
              }`}
            >
              {meta && <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />}
              {filterLabel(f)}
            </button>
          );
        })}
      </div>

      {/* Roster list */}
      <div className="flex-1 overflow-y-auto">
        {sorted.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 text-center gap-2">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center">
              <IoAddOutline className="text-indigo-400 text-xl" />
            </div>
            <p className="text-sm font-semibold text-gray-500">No students yet</p>
            <button
              onClick={onAddStudent}
              className="mt-1 text-xs text-indigo-500 hover:text-indigo-700 font-semibold underline"
            >
              Add a student
            </button>
          </div>
        )}

        {/* Column headers */}
        {sorted.length > 0 && (
          <div className="flex items-center px-4 py-1.5 border-b border-gray-50 bg-gray-50/50">
            <button
              type="button"
              onClick={() => onSortRequest('name')}
              className="flex-1 text-left text-[9px] font-black uppercase tracking-widest text-gray-400 hover:text-gray-600"
            >
              Student{renderSortIndicator('name')}
            </button>
            <button
              type="button"
              onClick={() => onSortRequest('essays')}
              className="w-16 text-[9px] font-black uppercase tracking-widest text-gray-400 text-center hover:text-gray-600"
            >
              Essays{renderSortIndicator('essays')}
            </button>
            <button
              type="button"
              onClick={() => onSortRequest('level')}
              className="w-24 text-[9px] font-black uppercase tracking-widest text-gray-400 text-center hover:text-gray-600"
            >
              Level{renderSortIndicator('level')}
            </button>
            <button
              type="button"
              onClick={() => onSortRequest('rating')}
              className="w-14 text-[9px] font-black uppercase tracking-widest text-gray-400 text-right hover:text-gray-600"
            >
              Rating{renderSortIndicator('rating')}
            </button>
            <span className="w-7" />
          </div>
        )}

        {sorted.map((student, idx) => {
          const prof = latestProf(student);
          const meta = prof ? PROF_META[prof] : null;
          const rating = avgRating(student);
          const essayCount = subjectEssays(student).length;
          const isSelected = selectedStudentId === student.id;
          const isMenuOpen = menuStudentId === student.id;

          return (
            <div
              key={student.id}
              className={`group relative flex items-center px-4 py-2.5 cursor-pointer transition-colors border-b border-gray-50 ${
                isSelected
                  ? 'bg-indigo-50 border-l-2 border-l-indigo-500'
                  : 'hover:bg-gray-50/60 border-l-2 border-l-transparent'
              }`}
              onClick={() => onSelectStudent(student.id)}
            >
              {/* Avatar */}
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 mr-3 ${
                isSelected ? 'bg-indigo-200 text-indigo-700' : 'bg-gray-100 text-gray-500'
              }`}>
                {student.name.trim().charAt(0).toUpperCase()}
              </div>

              {/* Name */}
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-semibold truncate ${isSelected ? 'text-indigo-800' : 'text-gray-800'}`}>
                  {student.name}
                </div>
              </div>

              {/* Essay count */}
              <div className="w-16 text-center">
                <span className={`text-xs font-bold tabular-nums ${essayCount > 0 ? 'text-gray-600' : 'text-gray-300'}`}>
                  {essayCount}
                </span>
              </div>

              {/* Proficiency */}
              <div className="w-24 flex justify-center">
                {meta ? (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${meta.pill}`}>
                    {profLabel(prof!)}
                  </span>
                ) : (
                  <span className="text-[10px] text-gray-300">—</span>
                )}
              </div>

              {/* Rating */}
              <div className="w-14 flex items-center justify-end gap-0.5">
                {rating ? (
                  <>
                    <IoStar className="text-amber-400 text-[10px]" />
                    <span className="text-xs font-bold text-amber-600 tabular-nums">{rating}</span>
                  </>
                ) : (
                  <span className="text-[10px] text-gray-300">—</span>
                )}
              </div>

              {/* ⋯ menu */}
              <div className="w-7 flex justify-end relative shrink-0">
                <button
                  onClick={e => { e.stopPropagation(); setMenuStudentId(isMenuOpen ? null : student.id); }}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-200 text-gray-400 transition-opacity"
                >
                  <IoEllipsisHorizontal className="text-sm" />
                </button>
                {isMenuOpen && (
                  <div
                    onClick={e => e.stopPropagation()}
                    className="absolute right-0 top-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl z-20 min-w-[160px] overflow-hidden"
                  >
                    {sections.filter(s => s.id !== student.sectionId).length > 0 && (
                      <>
                        <div className="px-3 py-1.5 text-[9px] font-black text-gray-400 uppercase tracking-widest">
                          Move to section
                        </div>
                        {sections.filter(s => s.id !== student.sectionId).map(sec => (
                          <button
                            key={sec.id}
                            className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
                            onClick={() => { onMoveStudent(student.id, sec.id); setMenuStudentId(null); }}
                          >
                            {sec.name}
                          </button>
                        ))}
                        <div className="border-t border-gray-100" />
                      </>
                    )}
                    <button
                      className="w-full text-left px-3 py-2 text-xs text-rose-600 hover:bg-rose-50"
                      onClick={() => { onDeleteStudent(student.id); setMenuStudentId(null); }}
                    >
                      Delete student
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
