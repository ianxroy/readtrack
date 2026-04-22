import React, { useState, useRef, useEffect } from 'react';
import {
  IoChevronDownOutline,
  IoAddOutline, IoCheckmarkOutline, IoCloseOutline,
  IoPencilOutline, IoTrashOutline, IoEllipsisVertical,
  IoListOutline, IoCloudUploadOutline, IoMenuOutline,
} from 'react-icons/io5';
import { Section, Subject, Student } from './types';
import { useT } from '../../services/i18n';

interface SidebarProps {
  sections: Section[];
  subjects: Subject[];
  students: Student[];
  selectedSectionId: string;
  selectedSubjectId: string;
  onSelectSubject: (sectionId: string, subjectId: string) => void;
  onCreateSection: (name: string) => void;
  onRenameSection: (id: string, name: string) => void;
  onDeleteSection: (id: string) => void;
  onManageSubjects: () => void;
  onUploadEssay?: () => void;
  onMenuClick?: () => void;
  uploadDisabled?: boolean;
  sectionDeleteNotice?: string | null;
  onDismissNotice?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  sections, subjects, students,
  selectedSectionId, selectedSubjectId,
  onSelectSubject, onCreateSection, onRenameSection, onDeleteSection,
  onManageSubjects, onUploadEssay, onMenuClick, uploadDisabled,
  sectionDeleteNotice, onDismissNotice,
}) => {
  const t = useT();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(selectedSectionId ? [selectedSectionId] : [])
  );
  const [showNewInput, setShowNewInput] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const newInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showNewInput) newInputRef.current?.focus();
  }, [showNewInput]);

  useEffect(() => {
    if (!menuOpenId) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest('[data-section-menu]') || t?.closest('[data-menu-trigger]')) return;
      setMenuOpenId(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpenId]);

  const toggleSection = (section: Section) => {
    const isExpanded = expandedSections.has(section.id);
    if (isExpanded) {
      setExpandedSections(prev => { const n = new Set(prev); n.delete(section.id); return n; });
    } else {
      setExpandedSections(new Set([section.id]));
      if (subjects.length > 0) onSelectSubject(section.id, subjects[0].id);
    }
  };

  const handleCreateSection = () => {
    if (!newSectionName.trim()) return;
    onCreateSection(newSectionName.trim());
    setNewSectionName('');
    setShowNewInput(false);
  };

  const handleRenameConfirm = () => {
    if (!renaming?.name.trim()) return;
    onRenameSection(renaming.id, renaming.name.trim());
    setRenaming(null);
  };

  const studentCount = (sectionId: string) =>
    students.filter(s => s.sectionId === sectionId).length;

  const langDot = (lang: Subject['language']) => (
    <span className={`w-1.5 h-1.5 rounded-full inline-block shrink-0 ${
      lang === 'english' ? 'bg-sky-400' : 'bg-rose-400'
    }`} />
  );

  return (
    <div className="w-72 shrink-0 flex flex-col h-full bg-white border-r border-gray-100">

      {/* Brand block — mirrors MaterialLibrary sidebar */}
      <div className="px-5 pt-5 pb-4 border-b border-gray-100 shrink-0">
        {onMenuClick && (
          <button onClick={onMenuClick} className="md:hidden mb-3 text-gray-400 hover:text-gray-700">
            <IoMenuOutline className="text-xl" />
          </button>
        )}
        <div className="text-[9px] font-black uppercase tracking-widest text-teal-500 mb-0.5">ReadTrack</div>
        <h1 className="text-base font-black text-gray-900 leading-tight">{t('sidebar_essay_grading')}</h1>
        <p className="text-[11px] text-gray-400 mt-0.5">
          {students.length} {students.length === 1 ? t('sidebar_student') : t('sidebar_students')}
        </p>
      </div>

      {/* Upload CTA */}
      <div className="px-4 py-3 border-b border-gray-100 shrink-0">
        <button
          onClick={onUploadEssay}
          disabled={uploadDisabled}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold transition-colors shadow-sm cursor-pointer"
        >
          <IoCloudUploadOutline className="text-base" />
          {t('sidebar_upload_essay')}
        </button>
      </div>

      {/* Section delete notice */}
      {sectionDeleteNotice && (
        <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 text-[11px] text-amber-700 flex items-center justify-between shrink-0">
          <span className="flex-1 leading-snug">{sectionDeleteNotice}</span>
          <button onClick={onDismissNotice} className="ml-2 font-semibold text-amber-700 hover:text-amber-900 shrink-0">✕</button>
        </div>
      )}

      {/* Sections header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0">
        <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">{t('sidebar_sections')}</span>
        <button
          onClick={onManageSubjects}
          className="flex items-center gap-1 text-[9px] font-bold text-indigo-500 hover:text-indigo-700 transition-colors"
        >
          <IoListOutline className="text-[10px]" />
          {t('sidebar_subjects')}
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
        {sections.map(section => {
          const isExpanded = expandedSections.has(section.id);
          const count = studentCount(section.id);
          const isRenaming = renaming?.id === section.id;
          const isMenuOpen = menuOpenId === section.id;
          const isActive = selectedSectionId === section.id;

          return (
            <div key={section.id}>
              {/* Section row */}
              <div className={`group flex items-center rounded-lg transition-colors ${
                isActive ? 'bg-indigo-50' : 'hover:bg-white'
              }`}>
                {isRenaming ? (
                  <div className="flex-1 flex items-center gap-1 px-2 py-1.5">
                    <input
                      autoFocus
                      className="flex-1 text-xs border border-indigo-300 rounded px-1.5 py-0.5 outline-none bg-white"
                      value={renaming.name}
                      onChange={e => setRenaming({ ...renaming, name: e.target.value })}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleRenameConfirm();
                        if (e.key === 'Escape') setRenaming(null);
                      }}
                    />
                    <button onClick={handleRenameConfirm} className="text-emerald-500 hover:text-emerald-700">
                      <IoCheckmarkOutline className="text-xs" />
                    </button>
                    <button onClick={() => setRenaming(null)} className="text-slate-400 hover:text-slate-600">
                      <IoCloseOutline className="text-xs" />
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => toggleSection(section)}
                      className="flex-1 flex items-center gap-1.5 px-2 py-1.5 text-left"
                    >
                      <IoChevronDownOutline
                        className={`text-[10px] text-slate-400 shrink-0 transition-transform duration-150 ${
                          isExpanded ? '' : '-rotate-90'
                        }`}
                      />
                      <span className={`text-xs font-semibold truncate ${
                        isActive ? 'text-indigo-700' : 'text-slate-700'
                      }`}>
                        {section.name}
                      </span>
                      <span className="ml-auto text-[9px] text-slate-400 shrink-0">{count}</span>
                    </button>
                    <div className="relative shrink-0 pr-1" data-menu-trigger="true">
                      <button
                        onClick={e => { e.stopPropagation(); setMenuOpenId(isMenuOpen ? null : section.id); }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-slate-200 text-slate-400 transition-opacity"
                      >
                        <IoEllipsisVertical className="text-[10px]" />
                      </button>
                      {isMenuOpen && (
                        <div data-section-menu="true" className="absolute left-0 top-full mt-0.5 bg-white border border-gray-100 rounded-xl shadow-xl z-30 min-w-[130px] overflow-hidden text-xs">
                          <button
                            onClick={() => { setRenaming({ id: section.id, name: section.name }); setMenuOpenId(null); }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-slate-700 hover:bg-slate-50"
                          >
                            <IoPencilOutline className="text-[11px]" /> {t('sidebar_rename')}
                          </button>
                          <button
                            onClick={() => { onDeleteSection(section.id); setMenuOpenId(null); }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-rose-600 hover:bg-rose-50"
                          >
                            <IoTrashOutline className="text-[11px]" /> {t('sidebar_delete')}
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Subjects inside section */}
              {isExpanded && (
                <div className="ml-3 mt-0.5 mb-1 space-y-0.5">
                  {subjects.map(sub => {
                    const isSubActive = isActive && selectedSubjectId === sub.id;
                    return (
                      <button
                        key={sub.id}
                        onClick={() => onSelectSubject(section.id, sub.id)}
                        className={`w-full flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-lg text-left transition-colors ${
                          isSubActive
                            ? 'bg-indigo-100 text-indigo-700'
                            : 'text-slate-500 hover:bg-white hover:text-slate-800'
                        }`}
                      >
                        {langDot(sub.language)}
                        <span className="text-[11px] font-medium truncate flex-1">{sub.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* New section input */}
        {showNewInput && (
          <div className="flex items-center gap-1 px-2 py-1.5">
            <input
              ref={newInputRef}
              className="flex-1 text-xs border border-indigo-300 rounded-lg px-2 py-1 outline-none bg-white"
              placeholder={t('sidebar_section_ph')}
              value={newSectionName}
              onChange={e => setNewSectionName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleCreateSection();
                if (e.key === 'Escape') { setShowNewInput(false); setNewSectionName(''); }
              }}
            />
            <button onClick={handleCreateSection} className="text-emerald-500 hover:text-emerald-700">
              <IoCheckmarkOutline className="text-xs" />
            </button>
            <button onClick={() => { setShowNewInput(false); setNewSectionName(''); }} className="text-slate-400">
              <IoCloseOutline className="text-xs" />
            </button>
          </div>
        )}
      </div>

      {/* Add section button */}
      <div className="shrink-0 border-t border-gray-100 p-2">
        <button
          onClick={() => setShowNewInput(true)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-semibold text-gray-400 hover:text-indigo-600 hover:bg-gray-50 transition-colors"
        >
          <IoAddOutline className="text-sm" />
          {t('sidebar_add_section')}
        </button>
      </div>
    </div>
  );
};
