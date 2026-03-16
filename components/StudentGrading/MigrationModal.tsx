import React, { useState } from 'react';
import { IoWarningOutline } from 'react-icons/io5';
import { Student, Section, Subject } from './types';

interface MigrationModalProps {
  students: Student[];
  sections: Section[];
  subjects: Subject[];
  onComplete: (migratedStudents: Student[]) => void;
}

export const MigrationModal: React.FC<MigrationModalProps> = ({
  students, sections, subjects, onComplete,
}) => {
  const [assignments, setAssignments] = useState<Record<string, string>>(
    // studentId → sectionId
    Object.fromEntries(students.filter(s => !s.sectionId).map(s => [s.id, '']))
  );
  const [essayAssignments, setEssayAssignments] = useState<Record<string, string>>(
    // essayId → subjectId
    Object.fromEntries(
      students.flatMap(s => s.essays.filter(e => !e.subjectId).map(e => [e.id, '']))
    )
  );

  const orphanedStudents = students.filter(s => !s.sectionId);
  const orphanedEssays = students.flatMap(s =>
    s.essays.filter(e => !e.subjectId).map(e => ({ ...e, studentName: s.name }))
  );

  const allAssigned =
    Object.values(assignments).every(v => v) &&
    Object.values(essayAssignments).every(v => v);

  const handleComplete = () => {
    if (!allAssigned) return;
    const migrated = students.map(s => ({
      ...s,
      sectionId: assignments[s.id] || s.sectionId,
      essays: s.essays.map(e => ({
        ...e,
        subjectId: essayAssignments[e.id] || e.subjectId,
      })),
    }));
    onComplete(migrated);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center gap-3 mb-2">
            <IoWarningOutline className="text-2xl text-amber-500" />
            <h2 className="text-base font-black text-gray-900">Data Migration Required</h2>
          </div>
          <p className="text-xs text-gray-500">
            Some existing students and essays need to be assigned to a section or subject before you can continue.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {orphanedStudents.length > 0 && (
            <div>
              <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">
                Assign Students to a Section (Seksyon)
              </h3>
              <div className="space-y-2">
                {orphanedStudents.map(s => (
                  <div key={s.id} className="flex items-center gap-3">
                    <span className="flex-1 text-sm font-semibold text-gray-800 truncate">{s.name}</span>
                    <select
                      className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-teal-400"
                      value={assignments[s.id] || ''}
                      onChange={e => setAssignments(prev => ({ ...prev, [s.id]: e.target.value }))}
                    >
                      <option value="">Select section…</option>
                      {sections.map(sec => (
                        <option key={sec.id} value={sec.id}>{sec.name}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {orphanedEssays.length > 0 && (
            <div>
              <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">
                Assign Essays to a Subject (Paksa)
              </h3>
              <div className="space-y-2">
                {orphanedEssays.map(e => (
                  <div key={e.id} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-gray-800 truncate">{e.title}</div>
                      <div className="text-[10px] text-gray-400">{e.studentName}</div>
                    </div>
                    <select
                      className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-teal-400"
                      value={essayAssignments[e.id] || ''}
                      onChange={ev => setEssayAssignments(prev => ({ ...prev, [e.id]: ev.target.value }))}
                    >
                      <option value="">Select subject…</option>
                      {subjects.map(sub => (
                        <option key={sub.id} value={sub.id}>{sub.name}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-100">
          <button
            onClick={handleComplete}
            disabled={!allAssigned}
            className="w-full py-3 rounded-xl bg-teal-500 hover:bg-teal-600 disabled:bg-gray-100 disabled:text-gray-400 text-white font-bold text-sm transition-colors"
          >
            {allAssigned ? 'Save & Continue →' : 'Assign all items to continue'}
          </button>
        </div>
      </div>
    </div>
  );
};
