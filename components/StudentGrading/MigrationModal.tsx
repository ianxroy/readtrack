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
    Object.fromEntries(students.filter(s => !s.sectionId).map(s => [s.id, '']))
  );
  const [essayAssignments, setEssayAssignments] = useState<Record<string, string>>(
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

  const selectClass = "w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 transition-all appearance-none";

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-3 mb-1.5">
            <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
              <IoWarningOutline className="text-amber-500 text-sm" />
            </div>
            <h2 className="text-sm font-bold text-slate-800">One-time Setup Needed</h2>
          </div>
          <p className="text-xs text-slate-500 ml-11 leading-relaxed">
            Some students and essays need a section or subject before you can continue.
          </p>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {orphanedStudents.length > 0 && (
            <div>
              <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">
                Assign Students to a Section
              </div>
              <div className="space-y-2">
                {orphanedStudents.map(s => (
                  <div key={s.id} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-500 shrink-0">
                      {s.name.trim().charAt(0).toUpperCase()}
                    </div>
                    <span className="flex-1 text-sm font-semibold text-slate-800 truncate">{s.name}</span>
                    <select
                      className={selectClass}
                      style={{ maxWidth: '160px' }}
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
              <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">
                Assign Essays to a Subject
              </div>
              <div className="space-y-2">
                {orphanedEssays.map(e => (
                  <div key={e.id} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-slate-800 truncate">{e.title}</div>
                      <div className="text-[10px] text-slate-400">{e.studentName}</div>
                    </div>
                    <select
                      className={selectClass}
                      style={{ maxWidth: '160px' }}
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

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex-shrink-0">
          <button
            onClick={handleComplete}
            disabled={!allAssigned}
            className="w-full py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-100 disabled:text-slate-400 text-white font-bold text-sm transition-colors"
          >
            {allAssigned ? 'Save & Continue →' : 'Assign all items to continue'}
          </button>
        </div>
      </div>
    </div>
  );
};
