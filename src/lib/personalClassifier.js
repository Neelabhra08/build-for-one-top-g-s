import { featureDistance } from './handFeatures.js';

export const REST_ID = '__rest__';
export const SENSITIVITY = { strict: 1, normal: 1.5, loose: 2.2 };

const MIN_THRESHOLD = 0.12;
const MAX_THRESHOLD = 0.45;
const SPREAD_FACTOR = 4;

function nearestMean(feature, examples, k) {
  const distances = [];
  for (const example of examples) {
    const d = featureDistance(feature, example);
    if (Number.isFinite(d)) distances.push(d);
  }
  if (distances.length === 0) return Infinity;
  distances.sort((a, b) => a - b);
  const top = distances.slice(0, Math.min(k, distances.length));
  return top.reduce((sum, d) => sum + d, 0) / top.length;
}

export function signThreshold(examples) {
  if (examples.length < 2) return MIN_THRESHOLD;
  const nearest = examples.map((example, i) => {
    let best = Infinity;
    examples.forEach((other, j) => {
      if (i !== j) best = Math.min(best, featureDistance(example, other));
    });
    return best;
  }).filter(Number.isFinite).sort((a, b) => a - b);
  if (nearest.length === 0) return MIN_THRESHOLD;
  const median = nearest[Math.floor(nearest.length / 2)];
  return Math.min(MAX_THRESHOLD, Math.max(MIN_THRESHOLD, median * SPREAD_FACTOR));
}

export function rankSigns(feature, signs, rest = [], k = 3) {
  if (!feature) return [];
  const ranked = signs
    .map((sign) => ({ id: sign.id, distance: nearestMean(feature, sign.examples, k) }))
    .filter((r) => Number.isFinite(r.distance));
  if (rest.length) {
    const distance = nearestMean(feature, rest, k);
    if (Number.isFinite(distance)) ranked.push({ id: REST_ID, distance });
  }
  return ranked.sort((a, b) => a.distance - b.distance);
}

export function recognizeSign(feature, signs, rest = [], sensitivity = SENSITIVITY.normal) {
  const ranked = rankSigns(feature, signs, rest);
  const best = ranked[0];
  if (!best) return { id: null, resting: false, ranked };
  if (best.id === REST_ID) return { id: null, resting: true, ranked };
  const sign = signs.find((s) => s.id === best.id);
  const limit = (sign?.threshold ?? MIN_THRESHOLD) * sensitivity;
  if (best.distance > limit) return { id: null, resting: false, ranked };
  return { id: best.id, distance: best.distance, limit, resting: false, ranked };
}

export function closestOtherSign(examples, signs, k = 3) {
  let closest = null;
  for (const sign of signs) {
    const distances = examples.map((e) => nearestMean(e, sign.examples, k)).filter(Number.isFinite);
    if (distances.length === 0) continue;
    const mean = distances.reduce((s, d) => s + d, 0) / distances.length;
    if (!closest || mean < closest.distance) closest = { id: sign.id, distance: mean };
  }
  return closest;
}
