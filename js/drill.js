// "Упражнения": random notes on one staff, from the chosen level.

import { LEVELS, keyboardRange } from './levels.js';
import { Exercise } from './exercise.js';
import { Stats } from './stats.js';
import { renderStaff } from './staff.js';
import { noteLabel } from './notes.js';

const HINT_AFTER_WRONG = 3;
const NEXT_DELAY_MS = { single: 350, line: 500 };

export function createDrill(ctx) {
  const { els, settings } = ctx;
  const stats = new Stats();
  let exercise = null;
  let ghost = null;
  let status = 'waiting';
  let busy = false; // between a finished round and the next one
  let timer = null;

  for (const level of LEVELS) els.level.add(new Option(level.name, level.id));
  els.level.value = settings.level;
  els.mode.value = settings.mode;
  for (const name of ['level', 'mode']) {
    els[name].addEventListener('change', () => {
      settings[name] = els[name].value;
      ctx.saveSettings();
      start();
    });
  }
  els.reset.addEventListener('click', () => {
    stats.reset();
    drawStats();
  });

  const currentLevel = () => LEVELS.find((l) => l.id === settings.level) ?? LEVELS[0];

  function start() {
    clearTimeout(timer);
    const level = currentLevel();
    ctx.setKeyboardRange(keyboardRange(level));
    exercise = new Exercise({ level, mode: settings.mode, stats });
    resetRound();
    draw();
  }

  function stop() {
    clearTimeout(timer);
  }

  function resetRound() {
    ghost = null;
    status = 'waiting';
    busy = false;
    ctx.keyboard().hint();
    ctx.setFeedback('');
  }

  function draw() {
    renderStaff(els.staff, {
      clef: currentLevel().clef,
      notes: exercise.sequence,
      index: exercise.index,
      status,
      ghost,
    });
    drawStats();
  }

  function drawStats() {
    const s = stats.session;
    if (!s.targets) {
      ctx.setStatus('Сыграйте ноту, которая на стане');
      return;
    }
    const pct = Math.round((100 * s.firstTry) / s.targets);
    const avg = (s.totalMs / s.targets / 1000).toFixed(1);
    ctx.setStatus(`С первой попытки ${s.firstTry} из ${s.targets} · ${pct}% · ${avg} с на ноту · серия ${s.streak}`);
  }

  function press(midi) {
    if (busy || !exercise) return;
    const keyboard = ctx.keyboard();
    const result = exercise.play(midi);

    if (result.correct) {
      keyboard.flash(midi, 'correct');
      keyboard.hint();
      ghost = null;
      if (result.roundDone) {
        status = 'correct';
        busy = true;
        ctx.setFeedback(settings.mode === 'line' ? 'Строка пройдена' : 'Верно', 'ok');
        draw();
        timer = setTimeout(() => {
          exercise.newRound();
          resetRound();
          draw();
        }, NEXT_DELAY_MS[settings.mode]);
      } else {
        status = 'waiting';
        ctx.setFeedback('');
        draw();
      }
      return;
    }

    keyboard.flash(midi, 'wrong');
    status = 'wrong';
    if (settings.mode === 'single') ghost = midi;
    ctx.setFeedback(`Это ${noteLabel(midi)}, попробуйте ещё`, 'bad');
    if (result.wrongCount >= HINT_AFTER_WRONG) {
      keyboard.hint([exercise.target]);
      ctx.setFeedback(`Подсказка: ${noteLabel(exercise.target)}, клавиша подсвечена`, 'bad');
    }
    draw();
  }

  return { start, stop, press };
}
