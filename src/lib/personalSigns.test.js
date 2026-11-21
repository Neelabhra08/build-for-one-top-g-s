import { describe, expect, it } from 'vitest';
import { extractFeatures, featureDistance, handCount } from './handFeatures.js';
import { closestOtherSign, recognizeSign, signThreshold } from './personalClassifier.js';

function hand(shape, { dx = 0, dy = 0, scale = 1, jitter = 0, seed = 1 } = {}) {
  let s = seed;
  const noise = () => {
    s = (s * 9301 + 49297) % 233280;
    return ((s / 233280) - 0.5) * jitter;
  };
  return shape.map(([x, y]) => ({ x: 0.5 + dx + x * scale + noise(), y: 0.5 + dy + y * scale + noise(), z: 0 }));
}

const OPEN = Array.from({ length: 21 }, (_, i) => [((i % 5) - 2) * 0.03, -Math.floor(i / 5) * 0.04]);
OPEN[0] = [0, 0];
OPEN[9] = [0, -0.1];
const FIST = Array.from({ length: 21 }, (_, i) => [((i % 3) - 1) * 0.015, -0.02 * (i % 4)]);
FIST[0] = [0, 0];
FIST[9] = [0, -0.1];

const frame = (...hands) => ({ landmarks: hands });

describe('hand features', () => {
  it('ignores where the hand is and how big it looks', () => {
    const a = extractFeatures(frame(hand(OPEN)));
    const b = extractFeatures(frame(hand(OPEN, { dx: 0.2, dy: -0.1, scale: 1.6 })));
    expect(featureDistance(a, b)).toBeLessThan(0.01);
  });

  it('tells different hand shapes apart', () => {
    const a = extractFeatures(frame(hand(OPEN)));
    const b = extractFeatures(frame(hand(FIST)));
    expect(featureDistance(a, b)).toBeGreaterThan(0.2);
  });

  it('never matches a one hand sign with a two hand sign', () => {
    const one = extractFeatures(frame(hand(OPEN)));
    const two = extractFeatures(frame(hand(OPEN, { dx: -0.2 }), hand(OPEN, { dx: 0.2 })));
    expect(handCount(one)).toBe(1);
    expect(handCount(two)).toBe(2);
    expect(featureDistance(one, two)).toBe(Infinity);
  });

  it('gives the same features for a portrait phone and a landscape laptop camera', () => {
    const pixels = OPEN.map(([x, y]) => ({ px: 300 + x * 1000, py: 300 + y * 1000 }));
    const seen = (width, height) => frame(pixels.map((p) => ({ x: p.px / width, y: p.py / height, z: 0 })));
    const landscape = extractFeatures(seen(640, 480), 640 / 480);
    const portrait = extractFeatures(seen(480, 640), 480 / 640);
    expect(featureDistance(landscape, portrait)).toBeLessThan(0.002);
  });

  it('returns nothing when no hand is visible', () => {
    expect(extractFeatures(frame())).toBeNull();
  });
});

describe('personal classifier', () => {
  const examples = (shape, n, base) =>
    Array.from({ length: n }, (_, i) => extractFeatures(frame(hand(shape, { jitter: 0.004, seed: base + i }))));

  const water = { id: 'water', examples: examples(OPEN, 10, 10) };
  const pain = { id: 'pain', examples: examples(FIST, 10, 50) };
  water.threshold = signThreshold(water.examples);
  pain.threshold = signThreshold(pain.examples);

  it('recognizes a taught sign shown again', () => {
    const probe = extractFeatures(frame(hand(OPEN, { jitter: 0.004, seed: 99, dx: 0.1 })));
    expect(recognizeSign(probe, [water, pain]).id).toBe('water');
  });

  it('stays silent when the resting pose is closest', () => {
    const rest = examples(FIST, 10, 200);
    expect(recognizeSign(extractFeatures(frame(hand(FIST))), [water], rest)).toMatchObject({ id: null, resting: true });
  });

  it('stays silent for a shape far from every taught sign', () => {
    const odd = OPEN.map(([x, y], i) => (i > 12 ? [x + 0.08, y + 0.08] : [x, y]));
    const probe = extractFeatures(frame(hand(odd)));
    expect(recognizeSign(probe, [pain]).id).toBeNull();
  });

  it('warns when a new sign looks like an existing one', () => {
    const lookalike = examples(OPEN, 10, 300);
    expect(closestOtherSign(lookalike, [water, pain]).id).toBe('water');
  });
});
