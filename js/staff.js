// Draws the notes with VexFlow (loaded globally from the CDN as window.Vex).

import { toVex } from './notes.js';

const VF = window.Vex.Flow;
const HEIGHT = 190;

const COLORS = {
  ink: '#1d1b17',
  current: '#1f4fa8',
  done: '#8f8a7e',
  correct: '#2f7d46',
  wrong: '#c2410c',
};

function makeNote(midi, clef, duration, color, ghost) {
  const main = toVex(midi);
  const keys = [main.key];
  const accidentals = [main.accidental];
  if (ghost != null && ghost !== midi) {
    const g = toVex(ghost);
    keys.push(g.key);
    accidentals.push(g.accidental);
  }

  const note = new VF.StaveNote({ keys, duration, clef, auto_stem: true });
  note.setStyle({ fillStyle: color, strokeStyle: color });
  note.setLedgerLineStyle({ strokeStyle: COLORS.ink, fillStyle: COLORS.ink });
  accidentals.forEach((acc, i) => {
    if (!acc) return;
    const a = new VF.Accidental(acc);
    if (i === 1) a.setStyle({ fillStyle: COLORS.wrong, strokeStyle: COLORS.wrong });
    note.addModifier(a, i);
  });
  if (keys.length > 1) note.setKeyStyle(1, { fillStyle: COLORS.wrong, strokeStyle: COLORS.wrong });
  return note;
}

/**
 * state.notes   — MIDI numbers to show
 * state.index   — the note being asked for (notes before it are done)
 * state.status  — 'waiting' | 'wrong' | 'correct' for the current note
 * state.ghost   — MIDI of a wrong note to show next to the target (single mode only)
 */
export function renderStaff(el, { clef, notes, index, status, ghost = null }) {
  el.innerHTML = '';
  const single = notes.length === 1;
  const width = single ? 230 : 110 + notes.length * 58;

  const renderer = new VF.Renderer(el, VF.Renderer.Backends.SVG);
  renderer.resize(width, HEIGHT);
  const ctx = renderer.getContext();

  const stave = new VF.Stave(6, 38, width - 12);
  stave.addClef(clef).setContext(ctx).draw();

  const staveNotes = notes.map((midi, i) => {
    let color = COLORS.ink;
    if (i < index) color = single ? COLORS.correct : COLORS.done;
    if (i === index && !single) color = status === 'wrong' ? COLORS.wrong : COLORS.current;
    if (i === index && single && status === 'correct') color = COLORS.correct;
    return makeNote(midi, clef, single ? 'w' : 'q', color, single ? ghost : null);
  });

  const voice = new VF.Voice({ num_beats: notes.length * (single ? 4 : 1), beat_value: 4 });
  voice.setMode(VF.Voice.Mode.SOFT);
  voice.addTickables(staveNotes);
  new VF.Formatter().joinVoices([voice]).formatToStave([voice], stave);
  if (single) staveNotes[0].setXShift(48);
  voice.draw(ctx, stave);

  // Let CSS scale the drawing to the available space.
  const svg = el.querySelector('svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${HEIGHT}`);
  svg.removeAttribute('width');
  svg.removeAttribute('height');
  svg.removeAttribute('style');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Нотный стан');
}
