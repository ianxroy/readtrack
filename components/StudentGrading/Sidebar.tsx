import React, { useState, useRef, useEffect } from 'react';
import {
  IoChevronDownOutline, IoChevronForwardOutline,
  IoEllipsisHorizontal, IoAddOutline, IoCheckmarkOutline, IoCloseOutline,
} from 'react-icons/io5';
import { Section, Subject, Student } from './types';

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
}

export const Sidebar: React.FC<SidebarProps> = ({
  sections, subjects, students,
  selectedSectionId, selectedSubjectId,
  onSelectSubject, onCreateSection, onRenameSection, onDeleteSection,
  onManageSubjects,
}) => {
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
      const target = e.target as HTMLElement | null;
      if (target?.closest('[data-section-menu="true"]') || target?.closest('[data-section-menu-trigger="true"]')) {
        return;
      }
      setMenuOpenId(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpenId]);

  const toggleSection = (section: Section) => {
    const isExpanded = expandedSections.has(section.id);
    if (isExpanded) {
      // Collapse this section
      setExpandedSections(prev => { const next = new Set(prev); next.delete(section.id); return next; });
    } else {
      // Accordion: collapse all others, expand this one
      setExpandedSections(new Set([section.id]));
      // Auto-select first subject
      if (subjects.length > 0) {
        onSelectSubject(section.id, subjects[0].id);
      }
    }
  };

  const handleCreateSection = () => {
    if (!newSectionName.trim()) return;
    onCreateSection(newSectionName.trim());
    setNewSectionName('');
    setShowNewInput(false);
  };

  const handleRenameConfirm = () => {
    if (!renaming || !renaming.name.trim()) return;
    onRenameSection(renaming.id, renaming.name.trim());
    setRenaming(null);
  };

  const studentCountInSection = (sectionId: string) =>
    students.filter(s => s.sectionId === sectionId).length;


  const langPill = (lang: Subject['language']) => (
    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${
      lang === 'english'
        ? 'bg-blue-50 text-blue-600 border-blue-200'
        : 'bg-pink-50 text-pink-600 border-pink-200'
    }`}>
      {lang === 'english' ? '🇺🇸' : '🇵🇭'}
    </span>
  );

  return (
    <div className="w-[200px] flex-shrink-0 bg-[#f8fafc] border-r border-gray-100 flex flex-col h-full">
      {/* Header */}
      <div className="px-3 pt-3 pb-1 flex items-center justify-between">
        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
          Sections (Seksyon)
        </span>
        <button
          onClick={onManageSubjects}
          className="text-[9px] font-bold text-teal-600 hover:text-teal-700"
        >
          ⚙ Subjects
        </button>
      </div>

      {/* Sections list */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {sections.map(section => {
          const isExpanded = expandedSections.has(section.id);
          const count = studentCountInSection(section.id);
          const isRenaming = renaming?.id === section.id;
          const isMenuOpen = menuOpenId === section.id;

          return (
            <div key={section.id} className="mb-0.5">
              {/* Section row */}
              <div className="flex items-center gap-1 group">
                {isRenaming ? (
                  <div className="flex-1 flex items-center gap-1.5 px-2 py-1.5">
                    <input
                      autoFocus
                      className="flex-1 text-xs font-semibold bg-white border border-indigo-300 rounded px-1 outline-none"
                      value={renaming.name}
                      onChange={e => setRenaming({ ...renaming, name: e.target.value })}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleRenameConfirm();
                        if (e.key === 'Escape') setRenaming(null);
                      }}
                    />
                  </div>
                ) : (
                  <button
                    onClick={() => toggleSection(section)}
                    className={`flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-left transition-colors ${
                      selectedSectionId === section.id
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    {isExpanded
                      ? <IoChevronDownOutline className="text-[11px] flex-shrink-0" />
                      : <IoChevronForwardOutline className="text-[11px] flex-shrink-0" />
                    }
                    <span className="flex-1 text-xs font-bold truncate">{section.name}</span>
                    <span className="text-[9px] bg-indigo-100 text-indigo-600 font-bold px-1.5 rounded-full ml-auto">
                      {count}
                    </span>
                  </button>
                )}

                {/* ⋯ menu */}
                <div className="relative">
                  <button
                    data-section-menu-trigger="true"
                    onClick={(e) => { e.stopPropagation(); setMenuOpenId(isMenuOpen ? null : section.id); }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-200 text-gray-500 transition-opacity"
                  >
                    <IoEllipsisHorizontal className="text-sm" />
                  </button>
                  {isMenuOpen && (
                    <div
                      data-section-menu="true"
                      className="absolute right-0 top-full mt-1 bg-white border border-gray-100 rounded-lg shadow-xl z-30 min-w-[130px] overflow-hidden"
                      onClick={e => e.stopPropagation()}
                      onMouseDown={e => e.stopPropagation()}
                    >
                      <button
                        className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 text-gray-700"
                        onClick={() => { setRenaming({ id: section.id, name: section.name }); setMenuOpenId(null); }}
                      >
                        Rename (Palitan)
                      </button>
                      <button
                        className="w-full text-left px-3 py-2 text-xs hover:bg-red-50 text-red-600"
                        onClick={() => { onDeleteSection(section.id); setMenuOpenId(null); }}
                      >
                        Delete (Burahin)
                        <span className="block text-[9px] text-gray-400">Deletes section, students, and essays</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Subjects (indented) */}
              {isExpanded && (
                <div className="pl-5 mt-0.5 space-y-0.5">
                  {subjects.length === 0 ? (
                    <button
                      onClick={onManageSubjects}
                      className="text-[10px] text-indigo-400 hover:text-indigo-600 px-2 py-1"
                    >
                      + Add a subject
                    </button>
                  ) : (
                    subjects.map(subject => (
                      <button
                        key={subject.id}
                        onClick={() => onSelectSubject(section.id, subject.id)}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors ${
                          selectedSectionId === section.id && selectedSubjectId === subject.id
                            ? 'bg-indigo-100 text-indigo-700'
                            : 'hover:bg-gray-100 text-gray-600'
                        }`}
                      >
                        {langPill(subject.language)}
                        <span className="text-[11px] font-semibold truncate">{subject.name}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Inline new section input */}
        {showNewInput && (
          <div className="flex items-center gap-1 px-2 py-1 mt-1">
            <input
              ref={newInputRef}
              className="flex-1 text-xs border border-teal-300 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-teal-400 bg-white"
              placeholder="Section name…"
              value={newSectionName}
              onChange={e => setNewSectionName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleCreateSection();
                if (e.key === 'Escape') { setShowNewInput(false); setNewSectionName(''); }
              }}
            />
            <button onClick={handleCreateSection} className="p-1 text-teal-600 hover:text-teal-700">
              <IoCheckmarkOutline className="text-sm" />
            </button>
            <button onClick={() => { setShowNewInput(false); setNewSectionName(''); }} className="p-1 text-gray-400 hover:text-gray-600">
              <IoCloseOutline className="text-sm" />
            </button>
          </div>
        )}
      </div>

      {/* Add section button */}
      <div className="p-2 border-t border-gray-100">
        {!showNewInput && (
          <button
            onClick={() => setShowNewInput(true)}
            className="w-full flex items-center justify-center gap-1.5 py-2 border-2 border-dashed border-gray-200 hover:border-teal-300 hover:text-teal-600 text-gray-400 rounded-xl text-xs font-bold transition-colors"
          >
            <IoAddOutline /> New Section
          </button>
        )}
      </div>

    </div>
  );
};
