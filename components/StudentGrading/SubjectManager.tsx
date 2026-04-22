import React, { useState } from 'react';
import { IoCloseOutline, IoAddOutline, IoTrashOutline, IoPencilOutline, IoCheckmarkOutline, IoWarningOutline } from 'react-icons/io5';
import { Subject, Student } from './types';
import { useT } from '../../services/i18n';

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
  const t = useT();
  const [newName, setNewName] = useState('');
  const [newLang, setNewLang] = useState<'english' | 'filipino' | ''>('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renamingValue, setRenamingValue] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

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
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-black text-gray-900">{t('subj_manage_title')}</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 text-gray-400">
            <IoCloseOutline className="text-lg" />
          </button>
        </div>

        {/* Subject list */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          {subjects.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-4">{t('subj_empty')}</p>
          )}
          {subjects.map(sub => {
            const count = essayCountForSubject(sub.id);
            const isRenaming = renamingId === sub.id;
            const canDelete = subjects.length > 1;
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
                <span className="text-[10px] text-gray-400">
                  {count} {count === 1 ? t('subj_essay') : t('subj_essays')}
                </span>
                {isRenaming ? (
                  <button onClick={handleRenameConfirm} className="p-1 text-teal-600"><IoCheckmarkOutline /></button>
                ) : (
                  <button onClick={() => { setRenamingId(sub.id); setRenamingValue(sub.name); }} className="p-1 text-gray-400 hover:text-gray-600">
                    <IoPencilOutline className="text-sm" />
                  </button>
                )}
                <button
                  onClick={() => setConfirmDeleteId(sub.id)}
                  disabled={!canDelete}
                  className="p-1 text-gray-400 hover:text-red-500 transition-colors disabled:text-gray-300 disabled:cursor-not-allowed"
                  title={canDelete ? t('subj_delete_title') : t('subj_delete_disabled')}
                >
                  <IoTrashOutline className="text-sm" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Add new subject */}
        <div className="px-6 pb-6 pt-4 border-t border-gray-100 space-y-2">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">{t('subj_add_header')}</div>
          <input
            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-teal-400"
            placeholder={t('subj_name_ph')}
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
          <select
            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-teal-400 appearance-none"
            value={newLang}
            onChange={e => setNewLang(e.target.value as any)}
          >
            <option value="">{t('subj_select_lang')}</option>
            <option value="english">🇺🇸 {t('gen_english')}</option>
            <option value="filipino">🇵🇭 {t('gen_filipino')}</option>
          </select>
          <button
            onClick={handleAdd}
            disabled={!newName.trim() || !newLang}
            className="w-full py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 disabled:bg-gray-100 disabled:text-gray-400 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors"
          >
            <IoAddOutline /> {t('subj_add_btn')}
          </button>
        </div>
      </div>
      {confirmDeleteId && (() => {
        const sub = subjects.find(s => s.id === confirmDeleteId)!;
        const count = essayCountForSubject(confirmDeleteId);
        const fallback = subjects.find(s => s.id !== confirmDeleteId);
        return (
          <div className="absolute inset-0 bg-white/90 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center p-6 gap-4 z-10">
            <IoWarningOutline className="text-4xl text-amber-400" />
            <div className="text-center">
              <p className="text-sm font-bold text-gray-900">{t('gen_delete')} "{sub.name}"?</p>
              {count > 0 && (
                <p className="text-xs text-amber-700 mt-1 bg-amber-50 rounded-lg px-3 py-1.5 border border-amber-100">
                  {fallback
                    ? `${count} ${count !== 1 ? t('subj_essays') : t('subj_essay')} tagged to this subject will be reassigned to "${fallback.name}".`
                    : t('subj_delete_impossible')}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200"
              >
                {t('gen_cancel')}
              </button>
              <button
                onClick={() => { onDelete(confirmDeleteId); setConfirmDeleteId(null); }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-red-500 hover:bg-red-600"
              >
                {t('subj_delete_btn')}
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
