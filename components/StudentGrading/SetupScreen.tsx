import React, { useState } from 'react';
import { IoSchoolOutline, IoAddOutline, IoCheckmarkOutline } from 'react-icons/io5';
import { Section, Subject } from './types';

interface SetupScreenProps {
  onComplete: (section: Section, subjects: Subject[]) => void;
}

export const SetupScreen: React.FC<SetupScreenProps> = ({ onComplete }) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [sectionName, setSectionName] = useState('');
  const [createdSection, setCreatedSection] = useState<Section | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectName, setSubjectName] = useState('');
  const [subjectLang, setSubjectLang] = useState<'english' | 'filipino' | ''>('');

  const handleCreateSection = () => {
    if (!sectionName.trim()) return;
    const section: Section = { id: Date.now().toString(), name: sectionName.trim() };
    setCreatedSection(section);
    setStep(2);
  };

  const handleAddSubject = () => {
    if (!subjectName.trim() || !subjectLang) return;
    const subject: Subject = {
      id: Date.now().toString(),
      name: subjectName.trim(),
      language: subjectLang,
    };
    setSubjects((prev) => [...prev, subject]);
    setSubjectName('');
    setSubjectLang('');
  };

  const handleFinish = () => {
    if (!createdSection || subjects.length === 0) return;
    onComplete(createdSection, subjects);
  };

  return (
    <div className="flex flex-col items-center justify-center h-full bg-[#F2F2F7] p-8">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 w-full max-w-md p-8">
        <div className="flex items-center gap-3 mb-6">
          <IoSchoolOutline className="text-3xl text-teal-500" />
          <div>
            <h1 className="text-lg font-black text-gray-900">Welcome to Student Grading</h1>
            <p className="text-xs text-gray-500">Let's set up your classes before we begin.</p>
          </div>
        </div>

        {/* Step indicators */}
        <div className="flex items-center gap-2 mb-8">
          {[1, 2].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black
                ${step === s ? 'bg-teal-500 text-white' : step > s ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
                {step > s ? <IoCheckmarkOutline /> : s}
              </div>
              <span className={`text-xs font-semibold ${step === s ? 'text-gray-800' : 'text-gray-400'}`}>
                {s === 1 ? 'Create Section' : 'Add Subjects'}
              </span>
              {s < 2 && <span className="text-gray-200 mx-1">›</span>}
            </div>
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                Section Name (Pangalan ng Seksyon)
              </label>
              <input
                autoFocus
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-400 outline-none"
                placeholder="e.g. Grade 7 – Rizal"
                value={sectionName}
                onChange={(e) => setSectionName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateSection()}
              />
            </div>
            <button
              onClick={handleCreateSection}
              disabled={!sectionName.trim()}
              className="w-full py-3 rounded-xl bg-teal-500 hover:bg-teal-600 disabled:bg-gray-100 disabled:text-gray-400 text-white font-bold text-sm transition-colors"
            >
              Create Section →
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-xs text-gray-500">
              Section <strong className="text-gray-800">{createdSection?.name}</strong> created. Now add at least one subject.
            </p>

            {subjects.length > 0 && (
              <div className="space-y-1 mb-2">
                {subjects.map((sub) => (
                  <div key={sub.id} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg border border-gray-100">
                    <span className="text-xs font-semibold text-gray-800">{sub.name}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sub.language === 'english' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'}`}>
                      {sub.language === 'english' ? '🇺🇸 English' : '🇵🇭 Filipino'}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                Subject Name (Pangalan ng Paksa)
              </label>
              <input
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-400 outline-none"
                placeholder="e.g. English, AP, Filipino, Math"
                value={subjectName}
                onChange={(e) => setSubjectName(e.target.value)}
              />
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                Grading Language (Wika ng Pagmamarka)
              </label>
              <select
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-400 outline-none appearance-none"
                value={subjectLang}
                onChange={(e) => setSubjectLang(e.target.value as 'english' | 'filipino' | '')}
              >
                <option value="">Select language…</option>
                <option value="english">🇺🇸 English</option>
                <option value="filipino">🇵🇭 Filipino</option>
              </select>
              <button
                onClick={handleAddSubject}
                disabled={!subjectName.trim() || !subjectLang}
                className="w-full py-2.5 rounded-xl border-2 border-dashed border-teal-300 hover:bg-teal-50 disabled:border-gray-200 disabled:text-gray-400 text-teal-600 font-bold text-sm transition-colors flex items-center justify-center gap-2"
              >
                <IoAddOutline /> Add Subject
              </button>
            </div>

            <button
              onClick={handleFinish}
              disabled={subjects.length === 0}
              className="w-full py-3 rounded-xl bg-teal-500 hover:bg-teal-600 disabled:bg-gray-100 disabled:text-gray-400 text-white font-bold text-sm transition-colors"
            >
              {subjects.length === 0 ? 'Add at least one subject' : 'Get Started →'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
