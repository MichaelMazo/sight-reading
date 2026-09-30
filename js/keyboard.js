// On-screen multitouch piano keyboard.

import { isBlack, noteName, noteNameWithOctave, noteLetter, noteLetterWithOctave } from './notes.js';

export function createKeyboard(el, { lo, hi, labels, onPress, onRelease }) {
  el.innerHTML = '';
  const keys = new Map();
  const whites = [];
  for (let m = lo; m <= hi; m++) if (!isBlack(m)) whites.push(m);

  const bed = document.createElement('div');
  bed.className = 'keys';
  el.append(bed);

  const whiteWidth = 100 / whites.length;
  for (let m = lo; m <= hi; m++) {
    const key = document.createElement('button');
    key.type = 'button';
    key.className = isBlack(m) ? 'key black' : 'key white';
    key.setAttribute('aria-label', `${noteNameWithOctave(m)} (${noteLetterWithOctave(m)})`);
    key.dataset.midi = m;

    if (isBlack(m)) {
      const whitesBefore = whites.filter((w) => w < m).length;
      key.style.left = `${whitesBefore * whiteWidth - whiteWidth * 0.3}%`;
      key.style.width = `${whiteWidth * 0.6}%`;
    } else {
      const label = labelFor(m, labels);
      if (label) {
        const span = document.createElement('span');
        span.className = m % 12 === 0 ? 'label label-c' : 'label';
        const letter = document.createElement('span');
        letter.className = 'label-letter';
        letter.textContent = label.letter;
        span.append(label.name, letter);
        key.append(span);
      }
    }

    bindPointer(key, m, onPress, onRelease);
    bed.append(key);
    keys.set(m, key);
  }

  const timers = new Map();
  return {
    setPressed(m, pressed) {
      keys.get(m)?.classList.toggle('pressed', pressed);
    },
    flash(m, kind) {
      const key = keys.get(m);
      if (!key) return;
      clearTimeout(timers.get(key));
      key.classList.remove('flash-correct', 'flash-wrong');
      void key.offsetWidth; // restart the animation
      key.classList.add(`flash-${kind}`);
      timers.set(key, setTimeout(() => key.classList.remove(`flash-${kind}`), 450));
    },
    // Outline the given keys (an array of MIDI numbers); empty clears.
    hint(ms = []) {
      for (const k of keys.values()) k.classList.remove('hint');
      for (const m of ms) keys.get(m)?.classList.add('hint');
    },
  };
}

// C keys carry the octave ("до¹" / "C4"), the others just the name ("ре" / "D").
function labelFor(m, mode) {
  const isC = m % 12 === 0;
  if (mode === 'none' || (mode === 'c' && !isC)) return null;
  return isC
    ? { name: noteNameWithOctave(m), letter: noteLetterWithOctave(m) }
    : { name: noteName(m), letter: noteLetter(m) };
}

function bindPointer(key, midi, onPress, onRelease) {
  const active = new Set();
  key.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    key.setPointerCapture(e.pointerId);
    active.add(e.pointerId);
    onPress(midi);
  });
  const release = (e) => {
    if (!active.delete(e.pointerId)) return;
    onRelease(midi);
  };
  key.addEventListener('pointerup', release);
  key.addEventListener('pointercancel', release);
  key.addEventListener('lostpointercapture', release);
  key.addEventListener('contextmenu', (e) => e.preventDefault());
}
