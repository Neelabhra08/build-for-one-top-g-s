import { FEATURE_LENGTH } from './handFeatures.js';
import { signThreshold } from './personalClassifier.js';

const KEY = 'ishara.mysigns.v1';

export const MAX_SIGN_EXAMPLES = 40;
export const MAX_PACK_EXAMPLES = 150;
export const MAX_REST_EXAMPLES = 60;

export const SIGN_LANGUAGES = [
  { id: 'home', label: 'Home signs', singular: 'home sign', plural: 'home signs', note: 'Gestures the family invented' },
  { id: 'isl', label: 'ISL', singular: 'ISL sign', plural: 'ISL signs', note: 'Indian Sign Language' },
  { id: 'asl', label: 'ASL', singular: 'ASL sign', plural: 'ASL signs', note: 'American Sign Language' },
];

export const EMPTY_STORE = {
  sets: { home: [], isl: [], asl: [] },
  signLanguage: 'home',
  rest: [],
  restThreshold: 0.12,
  sensitivity: 'normal',
};

function emptyStore() {
  return { ...EMPTY_STORE, sets: { home: [], isl: [], asl: [] } };
}

export function loadStore() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyStore();
    const data = JSON.parse(raw);
    const sets = { home: [], isl: [], asl: [], ...(data.sets ?? {}) };
    if (Array.isArray(data.signs) && data.signs.length && sets.home.length === 0) sets.home = data.signs;
    const { signs: _legacy, ...rest } = data;
    return {
      ...EMPTY_STORE,
      ...rest,
      sets,
      signLanguage: SIGN_LANGUAGES.some((l) => l.id === data.signLanguage) ? data.signLanguage : 'home',
      rest: Array.isArray(data.rest) ? data.rest : [],
    };
  } catch (error) {
    console.warn('Could not read saved signs, starting fresh:', error.message);
    return emptyStore();
  }
}

export function saveStore(store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
    return true;
  } catch (error) {
    console.error('Could not save signs on this device:', error.message);
    return false;
  }
}

export function activeSigns(store) {
  return store.sets?.[store.signLanguage] ?? [];
}

export function allSigns(store) {
  return Object.values(store.sets ?? {}).flat();
}

export function newSignId() {
  return `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function capExamples(list, max) {
  if (list.length <= max) return list;
  const step = list.length / max;
  return Array.from({ length: max }, (_, i) => list[Math.floor(i * step)]);
}

function validExample(example) {
  return Array.isArray(example) && example.length === FEATURE_LENGTH && example.every((n) => typeof n === 'number' && Number.isFinite(n));
}

export function parsePack(data) {
  if (!data || data.format !== 'ishara-pack' || !Array.isArray(data.signs)) {
    throw new Error('This is not an Ishara sign file');
  }
  const signs = data.signs
    .filter((s) => s && typeof s.id === 'string' && Array.isArray(s.examples))
    .map((s) => {
      const examples = capExamples(s.examples.filter(validExample), MAX_PACK_EXAMPLES);
      return {
        id: s.id,
        bn: String(s.bn ?? '').slice(0, 120),
        hi: String(s.hi ?? '').slice(0, 120),
        en: String(s.en ?? '').slice(0, 120),
        icon: typeof s.icon === 'string' ? s.icon : 'hand',
        examples,
        threshold: typeof s.threshold === 'number' ? s.threshold : signThreshold(examples),
        createdAt: s.createdAt ?? null,
        source: data.recordedBy ?? null,
      };
    })
    .filter((s) => s.examples.length > 0 && (s.bn || s.hi || s.en));
  return {
    signLanguage: SIGN_LANGUAGES.some((l) => l.id === data.signLanguage) ? data.signLanguage : null,
    recordedBy: typeof data.recordedBy === 'string' ? data.recordedBy.slice(0, 80) : null,
    signs,
  };
}

export function makePack(store, recordedBy) {
  return {
    format: 'ishara-pack',
    version: 1,
    signLanguage: store.signLanguage,
    recordedBy,
    exportedAt: new Date().toISOString(),
    signs: activeSigns(store),
  };
}

export function mergeSigns(existing, incoming) {
  const ids = new Set(existing.map((s) => s.id));
  return [...existing, ...incoming.filter((s) => !ids.has(s.id))];
}
