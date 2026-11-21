import { GESTURE_PHRASES, PHRASES } from './phrases.js';
import { recognizeSign, SENSITIVITY } from './personalClassifier.js';
import { topGesture } from './vision.js';

export function routeFrame(result, feature, store) {
  let resting = false;
  if (feature && (store.signs.length || store.rest.length)) {
    const sensitivity = SENSITIVITY[store.sensitivity] ?? SENSITIVITY.normal;
    const match = recognizeSign(feature, store.signs, store.rest, sensitivity, store.restThreshold);
    if (match.id) return { label: `my:${match.id}`, score: 1 };
    resting = match.resting;
  }
  if (!resting && store.everyday) return topGesture(result);
  return { label: null, score: 0 };
}

export function resolveLabel(label, store) {
  if (!label) return null;
  if (label.startsWith('my:')) return store.signs.find((s) => `my:${s.id}` === label) ?? null;
  return PHRASES[GESTURE_PHRASES[label]] ?? null;
}
