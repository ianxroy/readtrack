import React, { useState } from 'react';
import { IoCloseOutline } from 'react-icons/io5';
import { Section } from './types';

interface AddStudentModalProps {
  section: Section;
  onAdd: (name: string) => void;
  onClose: () => void;
}

export const AddStudentModal: React.FC<AddStudentModalProps> = ({ section, onAdd, onClose }) => {
  const [name, setName] = useState('');

  const handleSubmit = () => {
    if (!name.trim()) return;
    onAdd(name.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-black text-gray-900">Add Student (Magdagdag ng Mag-aaral)</h2>
            <p className="text-xs text-gray-400 mt-0.5">Section: <strong>{section.name}</strong></p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 text-gray-400">
            <IoCloseOutline className="text-lg" />
          </button>
        </div>
        <input
          autoFocus
          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-teal-400 mb-4"
          placeholder="Student full name…"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
        />
        <button
          onClick={handleSubmit}
          disabled={!name.trim()}
          className="w-full py-3 rounded-xl bg-teal-500 hover:bg-teal-600 disabled:bg-gray-100 disabled:text-gray-400 text-white font-bold text-sm transition-colors"
        >
          Add Student
        </button>
      </div>
    </div>
  );
};
