// Piano sound for the on-screen keyboard. A sampled grand piano loads in the
// background; until it is ready (or if it fails) a simple synth plays instead.

const PIANO_URL = 'https://esm.sh/smplr@0.16.1';
const MIN_SOUND_SEC = 0.35; // a quick tap still rings a little, like a real key

let ctx = null;
let piano = null;
const voices = new Map();

// Must be called from a user gesture (iOS only allows audio to start from one).
export function unlockAudio() {
  if (!ctx) {
    try {
      // Play even when the iPad's silent switch is on (Safari 17+).
      if (navigator.audioSession) navigator.audioSession.type = 'playback';
    } catch {}
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    loadPiano();
  }
  if (ctx.state === 'suspended') ctx.resume();
}

async function loadPiano() {
  try {
    const { SplendidGrandPiano } = await import(PIANO_URL);
    const p = new SplendidGrandPiano(ctx);
    await p.load;
    piano = p;
  } catch (err) {
    console.warn('Piano samples failed to load, using synth', err);
  }
}

export function noteOn(midi, velocity = 90) {
  unlockAudio();
  noteOff(midi);
  const startedAt = ctx.currentTime;
  const stop = piano ? piano.start({ note: midi, velocity }) : synth(midi, velocity);
  voices.set(midi, { stop, startedAt });
}

export function noteOff(midi) {
  const v = voices.get(midi);
  if (!v) return;
  voices.delete(midi);
  v.stop(Math.max(ctx.currentTime, v.startedAt + MIN_SOUND_SEC));
}

function synth(midi, velocity) {
  const t = ctx.currentTime;
  const freq = 440 * 2 ** ((midi - 69) / 12);
  const gain = ctx.createGain();
  const peak = 0.22 * (velocity / 127);
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(peak, t + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 2.5);
  gain.connect(ctx.destination);

  const oscs = [
    [freq, 'triangle', 1],
    [freq * 2, 'sine', 0.3],
  ].map(([f, type, level]) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = f;
    g.gain.value = level;
    o.connect(g).connect(gain);
    o.start(t);
    o.stop(t + 2.6);
    return o;
  });

  return (when = ctx.currentTime) => {
    if (gain.gain.cancelAndHoldAtTime) gain.gain.cancelAndHoldAtTime(when);
    else gain.gain.cancelScheduledValues(when);
    gain.gain.setTargetAtTime(0, when, 0.06);
    oscs.forEach((o) => {
      try {
        o.stop(when + 0.4);
      } catch {}
    });
  };
}
