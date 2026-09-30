// Per-note history (kept in localStorage) plus counters for the current session.

const STORAGE_KEY = 'sight-reading.stats.v1';

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? {};
  } catch {
    return {};
  }
}

export class Stats {
  constructor() {
    this.notes = load();
    this.resetSession();
  }

  resetSession() {
    this.session = { targets: 0, firstTry: 0, streak: 0, totalMs: 0 };
  }

  reset() {
    this.notes = {};
    this.resetSession();
    this.save();
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.notes));
    } catch {
      // Storage unavailable (private mode): stats just live for this session.
    }
  }

  record(midi, { firstTry, ms }) {
    const n = (this.notes[midi] ??= { attempts: 0, errors: 0, totalMs: 0 });
    n.attempts++;
    if (!firstTry) n.errors++;
    n.totalMs += ms;
    this.save();

    const s = this.session;
    s.targets++;
    s.totalMs += ms;
    if (firstTry) {
      s.firstTry++;
      s.streak++;
    } else {
      s.streak = 0;
    }
  }

  // Notes you miss more often come up more often. Unseen notes get a moderate boost.
  weight(midi) {
    const n = this.notes[midi];
    const attempts = n?.attempts ?? 0;
    const errors = n?.errors ?? 0;
    return 1 + (4 * (errors + 0.3)) / (attempts + 1);
  }
}
