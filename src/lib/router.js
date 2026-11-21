import { recognizeSign, SENSITIVITY } from './personalClassifier.js';
import { activeSigns, allSigns } from './signStore.js';

export function routeFrame(feature, store) {
  const signs = activeSigns(store);
  if (!feature || signs.length === 0) return { label: null, score: 0 };
  const sensitivity = SENSITIVITY[store.sensitivity] ?? SENSITIVITY.normal;
  const match = recognizeSign(feature, signs, store.rest, sensitivity, store.restThreshold);
  return match.id ? { label: `my:${match.id}`, score: 1 } : { label: null, score: 0 };
}

export function resolveLabel(label, store) {
  if (!label?.startsWith('my:')) return null;
  return allSigns(store).find((s) => `my:${s.id}` === label) ?? null;
}

export function defaultListenerId(listeners) {
  return (listeners.find((l) => l.lang === 'en-IN') ?? listeners[0]).id;
}
