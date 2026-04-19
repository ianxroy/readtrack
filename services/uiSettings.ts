export type UILanguagePreference = 'automatic' | 'english' | 'tagalog';
export type UILanguageResolved = 'english' | 'filipino';

const UI_LANGUAGE_KEY = 'readtrack.ui.language';
const UI_LANGUAGE_EVENT = 'readtrack-ui-language-changed';

export function getUILanguagePreference(): UILanguagePreference {
  if (typeof window === 'undefined') return 'automatic';
  const value = window.localStorage.getItem(UI_LANGUAGE_KEY);
  if (value === 'automatic' || value === 'english' || value === 'tagalog') {
    return value;
  }
  return 'automatic';
}

export function setUILanguagePreference(value: UILanguagePreference): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(UI_LANGUAGE_KEY, value);
  window.dispatchEvent(new Event(UI_LANGUAGE_EVENT));
}

export function resolveUILanguage(
  preference: UILanguagePreference,
  automaticLanguage: UILanguageResolved
): UILanguageResolved {
  if (preference === 'english') return 'english';
  if (preference === 'tagalog') return 'filipino';
  return automaticLanguage;
}

export function subscribeUILanguagePreferenceChange(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const onStorage = (event: StorageEvent) => {
    if (event.key === UI_LANGUAGE_KEY) callback();
  };

  window.addEventListener('storage', onStorage);
  window.addEventListener(UI_LANGUAGE_EVENT, callback);

  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(UI_LANGUAGE_EVENT, callback);
  };
}
