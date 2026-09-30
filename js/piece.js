// "Пьесы": play through a MusicXML score, the cursor waits for the right notes.

import * as library from './library.js';
import { loadScore, moveCursor, tintNotesUnderCursor, untint } from './score.js';
import { PieceSession } from './pieceEngine.js';
import { noteLabel } from './notes.js';

const HINT_AFTER_WRONG = 3;
const PLAYED_COLOR = '#9a9486';
const ACCOMPANIMENT_VELOCITY = 70;
// The other hand is played in time with the user's last note, at this tempo.
const ACCOMPANIMENT_QUARTER_BPM = 60;
const WHOLE_NOTE_MS = (4 * 60000) / ACCOMPANIMENT_QUARTER_BPM;

export function createPiece(ctx) {
  const { els, settings } = ctx;
  let score = null;
  let session = null;
  let cursorIndex = 0;
  let autoTimer = null;
  let sounding = new Map(); // midi -> timer that releases it
  let beat = null; // { wall, time }: when (clock ms) the last position started, and its score time
  let accompanied = false;
  let wrongHere = 0;
  let tints = []; // [{ index, changes }]
  let loadToken = 0;

  els.hands.value = settings.hands;
  els.hands.addEventListener('change', () => {
    settings.hands = els.hands.value;
    ctx.saveSettings();
    if (!session) return;
    session.setHands(settings.hands);
    silence();
    arrive();
  });
  els.piece.addEventListener('change', () => loadPiece(els.piece.value));
  els.open.addEventListener('click', () => els.file.click());
  els.file.addEventListener('change', async () => {
    const file = els.file.files[0];
    els.file.value = '';
    if (!file) return;
    try {
      const id = await library.addFile(file);
      await fillPieceList();
      await loadPiece(id);
    } catch (err) {
      console.error(err);
      ctx.setFeedback('Не удалось открыть файл', 'bad');
    }
  });
  els.deletePiece.addEventListener('click', async () => {
    const id = settings.piece;
    const title = els.piece.selectedOptions[0]?.textContent ?? '';
    if (!id.startsWith('user:') || !confirm(`Удалить «${title}» из библиотеки?`)) return;
    await library.removePiece(id);
    await fillPieceList();
    await loadPiece(library.DEFAULT_PIECE);
  });
  els.back.addEventListener('click', back);
  els.restart.addEventListener('click', restart);

  async function fillPieceList() {
    const groups = [
      ['Примеры', library.builtInPieces()],
      ['Мои файлы', await library.userPieces()],
    ];
    els.piece.innerHTML = '';
    for (const [label, pieces] of groups) {
      if (!pieces.length) continue;
      const group = document.createElement('optgroup');
      group.label = label;
      for (const p of pieces) group.append(new Option(p.title, p.id));
      els.piece.append(group);
    }
  }

  async function start() {
    await fillPieceList();
    await loadPiece(settings.piece);
  }

  function stop() {
    clearTimeout(autoTimer);
    silence();
  }

  async function loadPiece(id) {
    const token = ++loadToken;
    stop();
    ctx.setFeedback('Загружаю ноты…');
    let loaded;
    try {
      loaded = await loadScore(els.score, await library.getContent(id));
    } catch (err) {
      console.error(err);
      if (token !== loadToken) return;
      if (id !== library.DEFAULT_PIECE) return loadPiece(library.DEFAULT_PIECE);
      ctx.setFeedback('Не удалось прочитать ноты', 'bad');
      return;
    }
    if (token !== loadToken) return;

    score = loaded;
    settings.piece = id;
    ctx.saveSettings();
    els.piece.value = id;
    els.deletePiece.hidden = !id.startsWith('user:');

    session = new PieceSession(score.positions, settings.hands);
    cursorIndex = 0;
    tints = [];
    ctx.setKeyboardRange(score.range);
    ctx.setFeedback('');
    arrive();
  }

  // Called whenever the cursor lands on a new position.
  function arrive() {
    clearTimeout(autoTimer);
    accompanied = false;
    wrongHere = 0;
    ctx.keyboard().hint();

    if (!session.finished) {
      moveCursor(score.osmd, cursorIndex, session.index);
      cursorIndex = session.index;
    }
    drawStatus();

    if (session.finished) {
      const errors = session.errors;
      ctx.setFeedback(errors ? `Пьеса пройдена. Ошибок: ${errors}` : 'Пьеса пройдена без ошибок', 'ok');
      return;
    }
    // Only the other hand plays here: the app plays it when its time comes,
    // counted from the start of the previous position, then moves on.
    if (session.required().size === 0) {
      const time = session.position.time;
      const delay = beat ? (time - beat.time) * WHOLE_NOTE_MS - (performance.now() - beat.wall) : 0;
      autoTimer = setTimeout(() => {
        accompany();
        tintCurrent();
        session.advance();
        arrive();
      }, Math.max(0, delay));
    }
  }

  // The user got ahead of the app: skip the other hand's notes still waiting to
  // sound, up to the next position the user plays.
  function skipAutoPositions() {
    clearTimeout(autoTimer);
    while (!session.finished && session.required().size === 0) {
      tintCurrent();
      session.advance();
      if (!session.finished) {
        moveCursor(score.osmd, cursorIndex, session.index);
        cursorIndex = session.index;
      }
    }
    arrive();
  }

  function drawStatus() {
    if (!session) return;
    const measure = Math.min(session.currentMeasure + 1, session.measureCount);
    ctx.setStatus(`Такт ${measure} из ${session.measureCount} · ошибок ${session.errors}`);
  }

  // Marks the start of the current position (the user's first right note, or the
  // app's turn) and plays the other hand's notes there, each for its written length.
  function accompany() {
    if (accompanied) return;
    accompanied = true;
    beat = { wall: performance.now(), time: session.position.time };
    for (const { midi, length } of session.accompaniment()) {
      clearTimeout(sounding.get(midi));
      ctx.audio.noteOn(midi, ACCOMPANIMENT_VELOCITY);
      sounding.set(
        midi,
        setTimeout(() => {
          sounding.delete(midi);
          ctx.audio.noteOff(midi);
        }, length * WHOLE_NOTE_MS),
      );
    }
  }

  function silence() {
    for (const [midi, timer] of sounding) {
      clearTimeout(timer);
      ctx.audio.noteOff(midi);
    }
    sounding.clear();
    beat = null;
  }

  function tintCurrent(midi = null) {
    const changes = tintNotesUnderCursor(score.osmd, PLAYED_COLOR, midi);
    if (changes.length) tints.push({ index: session.index, changes });
  }

  // Undo tints newest first: a note tinted twice must end up with its original color.
  function untintFrom(index) {
    while (tints.length && tints[tints.length - 1].index >= index) untint(tints.pop().changes);
  }

  function press(midi) {
    if (!session || session.finished) return;
    if (session.required().size === 0) {
      skipAutoPositions();
      if (session.finished) return;
    }
    const keyboard = ctx.keyboard();
    const before = session.index;
    // The other hand sounds together with the user's first right note here. This
    // must happen before session.press(), which moves on once the position is complete.
    if (session.required().has(midi)) accompany();
    const result = session.press(midi);

    if (result === 'wrong') {
      wrongHere++;
      keyboard.flash(midi, 'wrong');
      if (wrongHere >= HINT_AFTER_WRONG) {
        const missing = session.missing();
        keyboard.hint(missing);
        ctx.setFeedback(`Подсказка: ${missing.map((m) => noteLabel(m)).join(', ')}`, 'bad');
      } else {
        ctx.setFeedback(`Это ${noteLabel(midi)}, здесь нужна другая нота`, 'bad');
      }
      drawStatus();
      return;
    }

    keyboard.flash(midi, 'correct');
    if (result === 'partial') {
      tintCurrent(midi);
      if (wrongHere >= HINT_AFTER_WRONG) keyboard.hint(session.missing());
      return;
    }
    // Position complete: tint everything under the cursor, then move on.
    tints.push({ index: before, changes: tintNotesUnderCursor(score.osmd, PLAYED_COLOR) });
    ctx.setFeedback('');
    arrive();
  }

  function back() {
    if (!session) return;
    session.back();
    silence();
    untintFrom(session.index);
    ctx.setFeedback(`Такт ${session.currentMeasure + 1}, с начала`);
    arrive();
  }

  function restart() {
    if (!session) return;
    session.restart();
    silence();
    untintFrom(0);
    ctx.setFeedback('');
    arrive();
  }

  return { start, stop, press, back };
}
