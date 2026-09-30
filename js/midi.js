// Physical MIDI keyboard via the Web MIDI API (Chrome/Edge on desktop; not Safari).

export async function initMidi({ onNoteOn, onNoteOff, onStatus }) {
  if (!navigator.requestMIDIAccess) {
    onStatus({ state: 'unsupported' });
    return;
  }

  let access;
  try {
    access = await navigator.requestMIDIAccess();
  } catch {
    onStatus({ state: 'denied' });
    return;
  }

  const handle = (e) => {
    const [status, note, velocity] = e.data;
    const command = status & 0xf0;
    if (command === 0x90 && velocity > 0) onNoteOn(note, velocity);
    else if (command === 0x80 || (command === 0x90 && velocity === 0)) onNoteOff(note);
  };

  const bind = () => {
    const names = [];
    for (const input of access.inputs.values()) {
      input.onmidimessage = handle;
      if (input.state === 'connected') names.push(input.name);
    }
    onStatus(names.length ? { state: 'connected', names } : { state: 'none' });
  };

  access.onstatechange = bind;
  bind();
}
