// Renders a MusicXML score with OpenSheetMusicDisplay and turns it into positions
// (one per cursor step) for the piece engine.

import { fitRange } from './notes.js';

const OSMD = window.opensheetmusicdisplay;

// OSMD's Note.halfTone counts from C0 in its own octave numbering; add this to get MIDI.
export const HALFTONE_TO_MIDI = 12;

export async function loadScore(container, content) {
  container.innerHTML = '';
  const osmd = new OSMD.OpenSheetMusicDisplay(container, {
    backend: 'svg',
    autoResize: true,
    drawTitle: true,
    drawSubtitle: false,
    drawComposer: true,
    drawLyricist: false,
    drawPartNames: false,
    drawPartAbbreviations: false,
    drawMeasureNumbers: true,
    followCursor: true,
    cursorsOptions: [{ type: 0, color: '#1f4fa8', alpha: 0.35, follow: true }],
  });
  await osmd.load(content);
  osmd.render();
  osmd.cursor.show();

  const positions = extractPositions(osmd);
  osmd.cursor.reset();

  const all = positions.flatMap((p) => p.notes.map((n) => n.midi));
  const range = all.length ? fitRange(Math.min(...all), Math.max(...all)) : fitRange(48, 72);
  return { osmd, positions, range };
}

function extractPositions(osmd) {
  const cursor = osmd.cursor;
  const instrument = osmd.Sheet.Instruments[0];
  const staves = instrument ? instrument.Staves : [];
  const positions = [];

  cursor.reset();
  while (!cursor.Iterator.EndReached) {
    const notes = [];
    for (const entry of cursor.Iterator.CurrentVoiceEntries) {
      if (entry.IsGrace) continue;
      const staff = staves.indexOf(entry.ParentSourceStaffEntry.ParentStaff);
      if (staff < 0) continue; // another instrument
      for (const note of entry.Notes) {
        if (note.isRest()) continue;
        notes.push({
          midi: note.halfTone + HALFTONE_TO_MIDI,
          staff,
          tied: Boolean(note.NoteTie && note.NoteTie.StartNote !== note),
          length: note.Length.RealValue, // in whole notes
        });
      }
    }
    positions.push({
      measure: cursor.Iterator.CurrentMeasureIndex,
      time: cursor.Iterator.CurrentEnrolledTimestamp.RealValue, // in whole notes from the start
      notes,
    });
    cursor.next();
  }
  return positions;
}

// Moves the cursor to position `index`, given where it is now.
export function moveCursor(osmd, from, index) {
  const cursor = osmd.cursor;
  if (index < from) {
    cursor.reset();
    from = 0;
  }
  for (let i = from; i < index; i++) cursor.next();
}

// Tints the noteheads under the cursor (optionally only the given pitch).
// Returns what it changed so it can be undone.
export function tintNotesUnderCursor(osmd, color, midi = null) {
  const changed = [];
  let gnotes = [];
  try {
    gnotes = osmd.cursor.GNotesUnderCursor();
  } catch {
    return changed;
  }
  for (const g of gnotes) {
    if (midi != null && g.sourceNote.halfTone + HALFTONE_TO_MIDI !== midi) continue;
    const el = g.getSVGGElement?.();
    if (!el) continue;
    for (const path of el.querySelectorAll('path')) {
      changed.push({ path, fill: path.getAttribute('fill'), stroke: path.getAttribute('stroke') });
      path.setAttribute('fill', color);
      path.setAttribute('stroke', color);
    }
  }
  return changed;
}

export function untint(changes) {
  for (const { path, fill, stroke } of [...changes].reverse()) {
    if (fill == null) path.removeAttribute('fill');
    else path.setAttribute('fill', fill);
    if (stroke == null) path.removeAttribute('stroke');
    else path.setAttribute('stroke', stroke);
  }
}
