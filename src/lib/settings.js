import { languageOf, VOICES } from './languages.js';

const KEY = 'ishara.settings.v1';

export const DEFAULT_LISTENERS = [
  { id: 'family', label: 'Family', lang: 'bn-IN', speaker: 'rupali' },
  { id: 'attendant', label: 'Attendant', lang: 'hi-IN', speaker: 'shubh' },
  { id: 'doctor', label: 'Doctor', lang: 'en-IN', speaker: 'ritu' },
];

export function loadSettings() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (data && Array.isArray(data.listeners) && data.listeners.length === DEFAULT_LISTENERS.length) {
      return {
        listeners: data.listeners.map((l, i) => ({
          ...DEFAULT_LISTENERS[i],
          lang: languageOf(l.lang).code,
          speaker: VOICES.includes(l.speaker) ? l.speaker : DEFAULT_LISTENERS[i].speaker,
        })),
      };
    }
  } catch (error) {
    console.warn('Could not read settings, using defaults:', error.message);
  }
  return { listeners: DEFAULT_LISTENERS.map((l) => ({ ...l })) };
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Could not save settings:', error.message);
  }
}

export function describeListener(listener) {
  const language = languageOf(listener.lang);
  return { ...listener, key: language.key, langLabel: language.label, voice: language.voice };
}
