import React, { useEffect, useState } from 'react';
import {
  getUILanguagePreference,
  setUILanguagePreference,
  subscribeUILanguagePreferenceChange,
  UILanguagePreference,
} from '../services/uiSettings';
import { useT } from '../services/i18n';

const optionClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-teal-200 focus:border-teal-300';

export const Settings: React.FC = () => {
  const t = useT();
  const [uiLanguage, setUiLanguage] = useState<UILanguagePreference>('automatic');

  useEffect(() => {
    setUiLanguage(getUILanguagePreference());
    return subscribeUILanguagePreferenceChange(() => setUiLanguage(getUILanguagePreference()));
  }, []);

  const handleLanguageChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value as UILanguagePreference;
    setUiLanguage(value);
    setUILanguagePreference(value);
  };

  return (
    <main className="flex-1 h-full min-h-0 overflow-y-auto bg-[#F5F4F0]">
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-teal-600 mb-1">ReadTrack</div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">{t('settings_title')}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{t('settings_subtitle')}</p>
        </div>

        <section className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
          <h2 className="text-sm font-bold text-slate-800 mb-1">{t('settings_lang_title')}</h2>
          <p className="text-xs text-slate-500 mb-3">{t('settings_lang_desc')}</p>
          <div className="max-w-sm">
            <select className={optionClass} value={uiLanguage} onChange={handleLanguageChange}>
              <option value="automatic">{t('settings_automatic')}</option>
              <option value="english">{t('settings_english')}</option>
              <option value="tagalog">{t('settings_tagalog')}</option>
            </select>
          </div>
        </section>
      </div>
    </main>
  );
};
