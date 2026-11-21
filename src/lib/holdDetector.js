export class HoldDetector {
  constructor({ holdMs = 900, cooldownMs = 2000, minScore = 0.6, graceMs = 250 } = {}) {
    this.holdMs = holdMs;
    this.cooldownMs = cooldownMs;
    this.minScore = minScore;
    this.graceMs = graceMs;
    this.reset();
  }

  reset() {
    this.current = null;
    this.startedAt = 0;
    this.lastSeenAt = 0;
    this.firedCurrent = false;
    this.cooldownUntil = 0;
  }

  update(label, score, now) {
    const valid = Boolean(label) && label !== 'None' && score >= this.minScore;

    if (!valid) {
      if (this.current && now - this.lastSeenAt <= this.graceMs) {
        return this.#state(now, null);
      }
      this.current = null;
      this.firedCurrent = false;
      return { label: null, progress: 0, fired: null };
    }

    if (label !== this.current) {
      this.current = label;
      this.startedAt = now;
      this.firedCurrent = false;
    }
    this.lastSeenAt = now;

    const progress = Math.min(1, (now - this.startedAt) / this.holdMs);
    if (progress >= 1 && !this.firedCurrent && now >= this.cooldownUntil) {
      this.firedCurrent = true;
      this.cooldownUntil = now + this.cooldownMs;
      return this.#state(now, label);
    }
    return this.#state(now, null);
  }

  #state(now, fired) {
    const progress = this.firedCurrent ? 1 : Math.min(1, (now - this.startedAt) / this.holdMs);
    return { label: this.current, progress, fired };
  }
}
