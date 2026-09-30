import { createKeyboard } from './keyboard.js';
import { unlockAudio, noteOn, noteOff } from './audio.js';
import { initMidi } from './midi.js';
import { initQwerty } from './qwerty.js';
import { createDrill } from './drill.js';
import { createPiece } from './piece.js';
import { DEFAULT_PIECE } from './library.js';

const SETTINGS_KEY = 'sight-reading.settings.v1';

const $ = (id) => document.getElementById(id);
const els = {
  level: $('level'),
  mode: $('mode'),
  labels: $('labels'),
  piece: $('piece'),
  open: $('open'),
  file: $('file'),
  deletePiece: $('delete-piece'),
  hands: $('hands'),
  stats: $('stats'),
  reset: $('reset'),
  source: $('input-source'),
  staff: $('staff'),
  score: $('score'),
  back: $('back'),
  restart: $('restart'),
  feedback: $('feedback'),
  keyboard: $('keyboard'),
};

function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY)) ?? {};
  } catch {
    return {};
  }
}

const settings = {
  section: 'drill',
  level: 't1',
  mode: 'single',
  labels: 'c',
  piece: DEFAULT_PIECE,
  hands: 'both',
  ...loadSettings(),
};

let keyboard = null;
let range = { lo: 48, hi: 72 };
let controller = null;

const ctx = {
  els,
  settings,
  audio: { noteOn, noteOff },
  saveSettings() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {}
  },
  keyboard: () => keyboard,
  setKeyboardRange(r) {
    if (keyboard && r.lo === range.lo && r.hi === range.hi) return;
    range = r;
    buildKeyboard();
  },
  setFeedback(text, kind = '') {
    els.feedback.textContent = text;
    els.feedback.className = kind ? `feedback ${kind}` : 'feedback';
  },
  setStatus(text) {
    els.stats.textContent = text;
  },
};

function buildKeyboard() {
  keyboard = createKeyboard(els.keyboard, {
    ...range,
    labels: settings.labels,
    onPress: (m) => press(m, 90, 'screen'),
    onRelease: (m) => release(m, 'screen'),
  });
}

function press(midi, velocity, source) {
  // A MIDI piano makes its own sound.
  if (source !== 'midi') noteOn(midi, velocity);
  keyboard.setPressed(midi, true);
  controller?.press(midi);
}

function release(midi, source) {
  if (source !== 'midi') noteOff(midi);
  keyboard.setPressed(midi, false);
}

const controllers = { drill: createDrill(ctx), piece: createPiece(ctx) };

async function showSection(section) {
  controller?.stop();
  settings.section = section;
  ctx.saveSettings();
  document.body.dataset.section = section;
  for (const b of document.querySelectorAll('[data-section-button]')) {
    b.setAttribute('aria-pressed', String(b.dataset.sectionButton === section));
  }
  ctx.setFeedback('');
  controller = controllers[section];
  await controller.start();
}

for (const b of document.querySelectorAll('[data-section-button]')) {
  b.addEventListener('click', () => showSection(b.dataset.sectionButton));
}

els.labels.value = settings.labels;
els.labels.addEventListener('change', () => {
  settings.labels = els.labels.value;
  ctx.saveSettings();
  buildKeyboard();
});

// Selects keep keyboard focus after a change; give it back to the page so
// arrow keys and the Mac-keyboard piano keep working.
for (const select of document.querySelectorAll('select')) {
  select.addEventListener('change', () => select.blur());
}

document.addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowLeft' || e.metaKey || e.ctrlKey || e.altKey) return;
  if (document.activeElement?.tagName === 'SELECT') return;
  e.preventDefault();
  controller?.back?.();
});

// iOS only lets audio start from a user gesture.
document.addEventListener('pointerdown', unlockAudio, { once: true, capture: true });
document.addEventListener('keydown', unlockAudio, { once: true, capture: true });

initQwerty({
  base: () => range.lo,
  onPress: (m) => press(m, 90, 'qwerty'),
  onRelease: (m) => release(m, 'qwerty'),
});

initMidi({
  onNoteOn: (m, v) => press(m, v, 'midi'),
  onNoteOff: (m) => release(m, 'midi'),
  onStatus: ({ state, names }) => {
    els.source.textContent = state === 'connected' ? `MIDI: ${names.join(', ')}` : 'Экранная клавиатура';
    els.source.classList.toggle('connected', state === 'connected');
  },
});

buildKeyboard();
showSection(settings.section in controllers ? settings.section : 'drill');
