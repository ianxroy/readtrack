import React, { useEffect, useState } from 'react';
import {
  getUILanguagePreference,
  setUILanguagePreference,
  subscribeUILanguagePreferenceChange,
  UILanguagePreference,
} from '../services/uiSettings';

const optionClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-teal-200 focus:border-teal-300';

export const Settings: React.FC = () => {
  const [uiLanguage, setUiLanguage] = useState<UILanguagePreference>('automatic');

  useEffect(() => {
    setUiLanguage(getUILanguagePreference());
    const unsubscribe = subscribeUILanguagePreferenceChange(() => {
      setUiLanguage(getUILanguagePreference());
    });
    return unsubscribe;
  }, []);

  const handleLanguageChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value as UILanguagePreference;
    setUiLanguage(value);
    setUILanguagePreference(value);
  };

  return (
    <main className="flex-1 h-full min-h-0 overflow-y-auto bg-gray-50">
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-teal-600 mb-1">ReadTrack</div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Settings</h1>
          <p className="text-sm text-gray-500 mt-0.5">Customize the app interface for your classroom workflow.</p>
        </div>

        <section className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
          <h2 className="text-sm font-bold text-slate-800 mb-1">Global UI Language</h2>
          <p className="text-xs text-slate-500 mb-3">Choose how labels and interface text are shown across the app.</p>
          <div className="max-w-sm">
            <select className={optionClass} value={uiLanguage} onChange={handleLanguageChange}>
              <option value="automatic">Automatic</option>
              <option value="english">English</option>
              <option value="tagalog">Tagalog</option>
            </select>
          </div>
        </section>
      </div>
    </main>
  );
};
