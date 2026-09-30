// Play with the Mac keyboard (layout-independent: uses physical key codes).
// Bottom row Z…/ is the lower octave, top row Q…P the upper one, with the
// number and home rows as black keys, like in trackers and Ableton.

const LOWER = ['KeyZ', 'KeyS', 'KeyX', 'KeyD', 'KeyC', 'KeyV', 'KeyG', 'KeyB', 'KeyH', 'KeyN', 'KeyJ', 'KeyM', 'Comma', 'KeyL', 'Period', 'Semicolon', 'Slash'];
const UPPER = ['KeyQ', 'Digit2', 'KeyW', 'Digit3', 'KeyE', 'KeyR', 'Digit5', 'KeyT', 'Digit6', 'KeyY', 'Digit7', 'KeyU', 'KeyI', 'Digit9', 'KeyO', 'Digit0', 'KeyP'];

const OFFSETS = new Map();
LOWER.forEach((code, i) => OFFSETS.set(code, i));
UPPER.forEach((code, i) => OFFSETS.set(code, 12 + i));

const isTyping = (el) => el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);

export function initQwerty({ base, onPress, onRelease }) {
  const down = new Map(); // code -> midi, so a note is released even if the base changes

  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || isTyping(document.activeElement)) return;
    const offset = OFFSETS.get(e.code);
    if (offset == null) return;
    e.preventDefault();
    if (e.repeat || down.has(e.code)) return;
    const midi = base() + offset;
    down.set(e.code, midi);
    onPress(midi);
  });

  document.addEventListener('keyup', (e) => {
    const midi = down.get(e.code);
    if (midi == null) return;
    down.delete(e.code);
    onRelease(midi);
  });

  window.addEventListener('blur', () => {
    for (const midi of down.values()) onRelease(midi);
    down.clear();
  });
}
