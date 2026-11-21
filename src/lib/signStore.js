const KEY = 'ishara.mysigns.v1';

export const MAX_SIGN_EXAMPLES = 40;
export const MAX_REST_EXAMPLES = 60;

export const EMPTY_STORE = {
  signs: [],
  rest: [],
  restThreshold: 0.12,
  everyday: true,
  sensitivity: 'normal',
};

export function loadStore() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY_STORE };
    const data = JSON.parse(raw);
    return {
      ...EMPTY_STORE,
      ...data,
      signs: Array.isArray(data.signs) ? data.signs : [],
      rest: Array.isArray(data.rest) ? data.rest : [],
    };
  } catch (error) {
    console.warn('Could not read saved signs, starting fresh:', error.message);
    return { ...EMPTY_STORE };
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

export function newSignId() {
  return `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function capExamples(list, max) {
  if (list.length <= max) return list;
  const step = list.length / max;
  return Array.from({ length: max }, (_, i) => list[Math.floor(i * step)]);
}
