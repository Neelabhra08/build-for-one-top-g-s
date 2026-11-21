import { describe, expect, it } from 'vitest';
import { HoldDetector } from './holdDetector.js';

function feed(detector, label, score, from, to, step = 33) {
  const fired = [];
  for (let t = from; t <= to; t += step) {
    const result = detector.update(label, score, t);
    if (result.fired) fired.push({ label: result.fired, t });
  }
  return fired;
}

describe('HoldDetector', () => {
  it('fires once after the sign is held long enough', () => {
    const detector = new HoldDetector({ holdMs: 900 });
    const fired = feed(detector, 'Thumb_Up', 0.9, 0, 3000);
    expect(fired).toHaveLength(1);
    expect(fired[0].label).toBe('Thumb_Up');
    expect(fired[0].t).toBeGreaterThanOrEqual(900);
  });

  it('does not fire for a short flash of a sign', () => {
    const detector = new HoldDetector({ holdMs: 900 });
    const fired = feed(detector, 'Victory', 0.9, 0, 500);
    feed(detector, null, 0, 533, 2000);
    expect(fired).toHaveLength(0);
  });

  it('ignores low confidence frames', () => {
    const detector = new HoldDetector({ holdMs: 900, minScore: 0.6 });
    expect(feed(detector, 'Closed_Fist', 0.4, 0, 3000)).toHaveLength(0);
  });

  it('survives a brief tracking dropout', () => {
    const detector = new HoldDetector({ holdMs: 900, graceMs: 250 });
    feed(detector, 'Pointing_Up', 0.9, 0, 500);
    detector.update(null, 0, 600);
    const fired = feed(detector, 'Pointing_Up', 0.9, 700, 1200);
    expect(fired).toHaveLength(1);
  });

  it('needs the sign to change or drop before firing again, and respects the cooldown', () => {
    const detector = new HoldDetector({ holdMs: 900, cooldownMs: 2000, graceMs: 100 });
    expect(feed(detector, 'Thumb_Up', 0.9, 0, 1000)).toHaveLength(1);
    expect(feed(detector, 'Thumb_Down', 0.9, 1033, 2500)).toHaveLength(0);
    expect(feed(detector, 'Thumb_Down', 0.9, 2533, 4000)).toHaveLength(1);
  });
});
