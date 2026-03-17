import React, { useState } from 'react';
import { IoCloseOutline, IoAddOutline, IoTrashOutline, IoPencilOutline, IoCheckmarkOutline } from 'react-icons/io5';
import { Subject, Student } from './types';

interface SubjectManagerProps {
  subjects: Subject[];
  students: Student[];
  onAdd: (subject: Subject) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export const SubjectManager: React.FC<SubjectManagerProps> = ({
  subjects, students, onAdd, onRename, onDelete, onClose,
}) => {
  const [newName, setNewName] = useState('');
  const [newLang, setNewLang] = useState<'english' | 'filipino' | ''>('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renamingValue, setRenamingValue] = useState('');

  const essayCountForSubject = (subjectId: string) =>
    students.reduce((acc, s) => acc + s.essays.filter(e => e.subjectId === subjectId).length, 0);

  const handleAdd = () => {
    if (!newName.trim() || !newLang) return;
    onAdd({ id: Date.now().toString(), name: newName.trim(), language: newLang });
    setNewName('');
    setNewLang('');
  };

  const handleRenameConfirm = () => {
    if (!renamingId || !renamingValue.trim()) return;
    onRename(renamingId, renamingValue.trim());
    setRenamingId(null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-black text-gray-900">Manage Subjects</h2>
            <p className="text-xs text-gray-400 mt-0.5">Pamamahala ng mga Paksa</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 text-gray-400">
            <IoCloseOutline className="text-lg" />
          </button>
        </div>

        {/* Subject list */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          {subjects.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-4">No subjects yet. Add one below.</p>
          )}
          {subjects.map(sub => {
            const count = essayCountForSubject(sub.id);
            const isRenaming = renamingId === sub.id;
            return (
              <div key={sub.id} className="flex items-center gap-2 px-3 py-2.5 border border-gray-100 rounded-xl bg-gray-50">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  sub.language === 'english' ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600'
                }`}>
                  {sub.language === 'english' ? '🇺🇸 EN' : '🇵🇭 FIL'}
                </span>
                {isRenaming ? (
                  <input
                    autoFocus
                    className="flex-1 text-sm border border-indigo-300 rounded px-2 py-0.5 outline-none"
                    value={renamingValue}
                    onChange={e => setRenamingValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleRenameConfirm(); if (e.key === 'Escape') setRenamingId(null); }}
                  />
                ) : (
                  <span className="flex-1 text-sm font-semibold text-gray-800">{sub.name}</span>
                )}
                <span className="text-[10px] text-gray-400">{count} essays</span>
                {isRenaming ? (
                  <button onClick={handleRenameConfirm} className="p-1 text-teal-600"><IoCheckmarkOutline /></button>
                ) : (
                  <button onClick={() => { setRenamingId(sub.id); setRenamingValue(sub.name); }} className="p-1 text-gray-400 hover:text-gray-600">
                    <IoPencilOutline className="text-sm" />
                  </button>
                )}
                <button
                  onClick={() => {
                    if (count > 0) {
                      alert(`${count} essay${count !== 1 ? 's' : ''} are tagged to "${sub.name}". Re-tag or delete those essays first.`);
                      return;
                    }
                    onDelete(sub.id);
                  }}
                  className={`p-1 ${count > 0 ? 'text-gray-200 cursor-not-allowed' : 'text-gray-400 hover:text-red-500'}`}
                  title={count > 0 ? 'Re-tag or delete essays first' : 'Delete subject'}
                >
                  <IoTrashOutline className="text-sm" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Add new subject */}
        <div className="px-6 pb-6 pt-4 border-t border-gray-100 space-y-2">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Add Subject (Magdagdag ng Paksa)</div>
          <input
            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-teal-400"
            placeholder="Subject name (e.g. English, AP, Math)"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
          <select
            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-teal-400 appearance-none"
            value={newLang}
            onChange={e => setNewLang(e.target.value as any)}
          >
            <option value="">Select grading language (Wika)…</option>
            <option value="english">🇺🇸 English</option>
            <option value="filipino">🇵🇭 Filipino</option>
          </select>
          <button
            onClick={handleAdd}
            disabled={!newName.trim() || !newLang}
            className="w-full py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 disabled:bg-gray-100 disabled:text-gray-400 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors"
          >
            <IoAddOutline /> Add Subject
          </button>
        </div>
      </div>
    </div>
  );
};
