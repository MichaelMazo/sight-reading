import { fitRange } from './notes.js';

// Exercise ranges. lo/hi are MIDI numbers; only natural notes are asked for now.
export const LEVELS = [
  { id: 't1', name: 'Скрипичный · до¹–соль¹ (C4–G4)', clef: 'treble', lo: 60, hi: 67 },
  { id: 't2', name: 'Скрипичный · до¹–до² (C4–C5)', clef: 'treble', lo: 60, hi: 72 },
  { id: 't3', name: 'Скрипичный · до¹–соль² (C4–G5)', clef: 'treble', lo: 60, hi: 79 },
  { id: 't4', name: 'Скрипичный · ля м.–до³ (A3–C6), добавочные', clef: 'treble', lo: 57, hi: 84 },
  { id: 'b1', name: 'Басовый · фа м.–до¹ (F3–C4)', clef: 'bass', lo: 53, hi: 60 },
  { id: 'b2', name: 'Басовый · до м.–до¹ (C3–C4)', clef: 'bass', lo: 48, hi: 60 },
  { id: 'b3', name: 'Басовый · до б.–ми¹ (C2–E4), добавочные', clef: 'bass', lo: 36, hi: 64 },
];

export const keyboardRange = (level) => fitRange(level.lo, level.hi, { extendDown: level.clef === 'bass' });
