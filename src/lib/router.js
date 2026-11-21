import { PHRASES, STARTER_GESTURES } from './phrases.js';
import { recognizeSign, SENSITIVITY } from './personalClassifier.js';
import { activeSigns, allSigns } from './signStore.js';
import { topGesture } from './vision.js';

const STARTER_BY_GESTURE = new Map(STARTER_GESTURES.map((s) => [s.gesture, s]));

export function routeFrame(result, feature, store) {
  const signs = activeSigns(store);
  let resting = false;
  if (feature && (signs.length || store.rest.length)) {
    const sensitivity = SENSITIVITY[store.sensitivity] ?? SENSITIVITY.normal;
    const match = recognizeSign(feature, signs, store.rest, sensitivity, store.restThreshold);
    if (match.id) return { label: `my:${match.id}`, score: 1 };
    resting = match.resting;
  }
  if (store.signLanguage === 'home' && !resting) {
    const gesture = topGesture(result);
    if (STARTER_BY_GESTURE.has(gesture.label)) return gesture;
  }
  return { label: null, score: 0 };
}

export function resolveLabel(label, store) {
  if (!label) return null;
  if (label.startsWith('my:')) return allSigns(store).find((s) => `my:${s.id}` === label) ?? null;
  const starter = STARTER_BY_GESTURE.get(label);
  return starter ? PHRASES[starter.phraseId] : null;
}

export function defaultListenerId(listeners) {
  return (listeners.find((l) => l.lang === 'en-IN') ?? listeners[0]).id;
}
