// The exercise engine: which notes to show and whether a played note is right.
// No DOM here, so it can later be reused as-is with any input source.

import { naturalsBetween } from './notes.js';

const LINE_LENGTH = 8;
// Melodic steps (in natural-note positions) for "line" mode: mostly steps and small leaps.
const STEPS = [-4, -3, -2, -2, -1, -1, -1, 1, 1, 1, 2, 2, 3, 4];

function pickWeighted(pool, weightOf, avoid) {
  const weights = pool.map((m) => (m === avoid ? 0 : weightOf(m)));
  let r = Math.random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

export class Exercise {
  constructor({ level, mode, stats }) {
    this.pool = naturalsBetween(level.lo, level.hi);
    this.mode = mode;
    this.stats = stats;
    this.last = null;
    this.newRound();
  }

  newRound() {
    const weightOf = (m) => this.stats.weight(m);
    const first = pickWeighted(this.pool, weightOf, this.last);
    this.sequence = [first];

    if (this.mode === 'line') {
      let pos = this.pool.indexOf(first);
      while (this.sequence.length < LINE_LENGTH) {
        let next = pos + STEPS[Math.floor(Math.random() * STEPS.length)];
        if (next < 0 || next >= this.pool.length) next = pos - Math.sign(next - pos);
        pos = Math.max(0, Math.min(this.pool.length - 1, next));
        this.sequence.push(this.pool[pos]);
      }
    }

    this.index = 0;
    this.startNote();
  }

  startNote() {
    this.wrongCount = 0;
    this.shownAt = performance.now();
  }

  get target() {
    return this.sequence[this.index];
  }

  get roundDone() {
    return this.index >= this.sequence.length;
  }

  // Returns { correct, roundDone, wrongCount }.
  play(midi) {
    if (this.roundDone) return { correct: false, roundDone: true, wrongCount: 0 };

    const target = this.target;
    if (midi !== target) {
      this.wrongCount++;
      return { correct: false, roundDone: false, wrongCount: this.wrongCount };
    }

    this.stats.record(target, {
      firstTry: this.wrongCount === 0,
      ms: performance.now() - this.shownAt,
    });
    this.last = target;
    this.index++;
    if (!this.roundDone) this.startNote();
    return { correct: true, roundDone: this.roundDone, wrongCount: 0 };
  }
}
