const WRIST = 0;
const MIDDLE_KNUCKLE = 9;
const POINTS = 21;
const HAND_SIZE = 1 + POINTS * 3;
const PAIR_OFFSET = HAND_SIZE * 2;
const PAIR_WEIGHT = 4;
const DEPTH_WEIGHT = 0.5;

export const FEATURE_LENGTH = PAIR_OFFSET + 2;

const round = (value) => Math.round(value * 1000) / 1000;

function normalizeHand(landmarks) {
  const wrist = landmarks[WRIST];
  const knuckle = landmarks[MIDDLE_KNUCKLE];
  const scale = Math.hypot(knuckle.x - wrist.x, knuckle.y - wrist.y) || 1e-6;
  const coords = new Array(POINTS * 3);
  for (let i = 0; i < POINTS; i += 1) {
    const p = landmarks[i];
    coords[i * 3] = (p.x - wrist.x) / scale;
    coords[i * 3 + 1] = (p.y - wrist.y) / scale;
    coords[i * 3 + 2] = (((p.z ?? 0) - (wrist.z ?? 0)) / scale) * DEPTH_WEIGHT;
  }
  return { coords, wrist, scale };
}

export function extractFeatures(result) {
  const hands = (result?.landmarks ?? []).slice(0, 2).map(normalizeHand);
  if (hands.length === 0) return null;
  hands.sort((a, b) => a.wrist.x - b.wrist.x);

  const vector = new Array(FEATURE_LENGTH).fill(0);
  hands.forEach((hand, slot) => {
    const offset = slot * HAND_SIZE;
    vector[offset] = 1;
    for (let j = 0; j < POINTS * 3; j += 1) vector[offset + 1 + j] = round(hand.coords[j]);
  });

  if (hands.length === 2) {
    const scale = (hands[0].scale + hands[1].scale) / 2;
    vector[PAIR_OFFSET] = round((hands[1].wrist.x - hands[0].wrist.x) / scale);
    vector[PAIR_OFFSET + 1] = round((hands[1].wrist.y - hands[0].wrist.y) / scale);
  }
  return vector;
}

export function handCount(vector) {
  return vector ? vector[0] + vector[HAND_SIZE] : 0;
}

export function featureDistance(a, b) {
  if (!a || !b || a[0] !== b[0] || a[HAND_SIZE] !== b[HAND_SIZE]) return Infinity;
  let sum = 0;
  let count = 0;
  for (const offset of [0, HAND_SIZE]) {
    if (!a[offset]) continue;
    for (let j = 1; j < HAND_SIZE; j += 1) {
      const d = a[offset + j] - b[offset + j];
      sum += d * d;
    }
    count += HAND_SIZE - 1;
  }
  if (a[0] && a[HAND_SIZE]) {
    const dx = a[PAIR_OFFSET] - b[PAIR_OFFSET];
    const dy = a[PAIR_OFFSET + 1] - b[PAIR_OFFSET + 1];
    sum += (dx * dx + dy * dy) * PAIR_WEIGHT;
    count += 2;
  }
  return count ? Math.sqrt(sum / count) : Infinity;
}
