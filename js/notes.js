// Helpers for MIDI note numbers. Middle C (до первой октавы) = 60.

const BLACK = new Set([1, 3, 6, 8, 10]);
const SOLFEGE = ['до', 'до♯', 'ре', 'ре♯', 'ми', 'фа', 'фа♯', 'соль', 'соль♯', 'ля', 'ля♯', 'си'];
const LETTERS = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const VEX =['c', 'c', 'd', 'd', 'e', 'f', 'f', 'g', 'g', 'a', 'a', 'b'];

// Russian octave names, keyed by scientific octave number (C4 = первая).
const OCTAVE_SUFFIX = { 1: ' контр.', 2: ' б.', 3: ' м.', 4: '¹', 5: '²', 6: '³', 7: '⁴' };

export const isBlack = (m) => BLACK.has(m % 12);
export const octaveOf = (m) => Math.floor(m / 12) - 1;

export function noteName(m, { capital = false } = {}) {
  const name = SOLFEGE[m % 12];
  return capital ? name[0].toUpperCase() + name.slice(1) : name;
}

export function noteNameWithOctave(m) {
  return noteName(m) + (OCTAVE_SUFFIX[octaveOf(m)] ?? '');
}

// Letter names: "E", and with the scientific octave number, "E4".
export const noteLetter = (m) => LETTERS[m % 12];
export const noteLetterWithOctave = (m) => noteLetter(m) + octaveOf(m);

// "ми (E)" — how a note is named in messages.
export const noteLabel = (m) => `${noteName(m)} (${noteLetter(m)})`;

// VexFlow key ("c/4") plus the accidental it needs, if any. Black keys are spelled as sharps.
export function toVex(m) {
  return { key: `${VEX[m % 12]}/${octaveOf(m)}`, accidental: isBlack(m) ? '#' : null };
}

// Keyboard range covering lo..hi: whole octaves from C to C, at least two octaves.
export function fitRange(lo, hi, { extendDown = false } = {}) {
  let from = lo - (lo % 12);
  let to = hi % 12 === 0 ? hi : hi - (hi % 12) + 12;
  while (to - from < 24) {
    if (extendDown) from -= 12;
    else to += 12;
  }
  return { lo: from, hi: to };
}

export function naturalsBetween(lo, hi) {
  const out = [];
  for (let m = lo; m <= hi; m++) if (!isBlack(m)) out.push(m);
  return out;
}
