// Builds a two-staff piano MusicXML score from a compact text notation, so
// built-in pieces (and later generated exercises) are short to write.
//
// Notation: measures are separated by "|", events by spaces.
//   E4/4     quarter E4         F#4/8   eighth F-sharp 4     Bb3/2.  dotted half B-flat 3
//   C3+G3/1  whole-note chord   r/4     quarter rest
// Durations: 1 whole, 2 half, 4 quarter, 8 eighth, 16 sixteenth; "." adds a dot.

const DIVISIONS = 4; // per quarter note
const TYPES = { 1: 'whole', 2: 'half', 4: 'quarter', 8: 'eighth', 16: '16th' };
const PITCH_RE = /^([A-Ga-g])(#|b)?(\d)$/;

function parsePitch(text) {
  const m = PITCH_RE.exec(text);
  if (!m) throw new Error(`Bad pitch: ${text}`);
  return { step: m[1].toUpperCase(), alter: m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0, octave: Number(m[3]) };
}

function parseEvent(token) {
  const [pitchPart, durPart] = token.split('/');
  const dotted = durPart.endsWith('.');
  const base = parseInt(durPart, 10);
  if (!TYPES[base]) throw new Error(`Bad duration: ${token}`);
  return {
    pitches: pitchPart.toLowerCase() === 'r' ? [] : pitchPart.split('+').map(parsePitch),
    duration: ((DIVISIONS * 4) / base) * (dotted ? 1.5 : 1),
    type: TYPES[base],
    dotted,
  };
}

const splitMeasures = (text) =>
  (text ?? '')
    .split('|')
    .map((m) => m.trim())
    .filter(Boolean)
    .map((m) => m.split(/\s+/).map(parseEvent));

function noteXml(ev, staff, voice) {
  const tail = `<duration>${ev.duration}</duration><voice>${voice}</voice><type>${ev.type}</type>${ev.dotted ? '<dot/>' : ''}<staff>${staff}</staff>`;
  if (!ev.pitches.length) return `<note><rest/>${tail}</note>`;
  return ev.pitches
    .map((p, i) => {
      const alter = p.alter ? `<alter>${p.alter}</alter>` : '';
      return `<note>${i ? '<chord/>' : ''}<pitch><step>${p.step}</step>${alter}<octave>${p.octave}</octave></pitch>${tail}</note>`;
    })
    .join('');
}

function wholeMeasureRest(duration, staff, voice) {
  return `<note><rest measure="yes"/><duration>${duration}</duration><voice>${voice}</voice><staff>${staff}</staff></note>`;
}

const escapeXml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function buildMusicXML({ title, composer = '', fifths = 0, time = [4, 4], right, left }) {
  const rh = splitMeasures(right);
  const lh = splitMeasures(left);
  const count = Math.max(rh.length, lh.length);
  const measureDuration = (DIVISIONS * 4 * time[0]) / time[1];

  const measures = [];
  for (let i = 0; i < count; i++) {
    const attributes =
      i === 0
        ? `<attributes><divisions>${DIVISIONS}</divisions><key><fifths>${fifths}</fifths></key>` +
          `<time><beats>${time[0]}</beats><beat-type>${time[1]}</beat-type></time><staves>2</staves>` +
          `<clef number="1"><sign>G</sign><line>2</line></clef><clef number="2"><sign>F</sign><line>4</line></clef></attributes>`
        : '';
    const upper = rh[i] ? rh[i].map((ev) => noteXml(ev, 1, 1)).join('') : wholeMeasureRest(measureDuration, 1, 1);
    const lower = lh[i] ? lh[i].map((ev) => noteXml(ev, 2, 5)).join('') : wholeMeasureRest(measureDuration, 2, 5);
    const barline = i === count - 1 ? '<barline location="right"><bar-style>light-heavy</bar-style></barline>' : '';
    measures.push(
      `<measure number="${i + 1}">${attributes}${upper}<backup><duration>${measureDuration}</duration></backup>${lower}${barline}</measure>`,
    );
  }

  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<score-partwise version="3.1">' +
    `<work><work-title>${escapeXml(title)}</work-title></work>` +
    `<identification><creator type="composer">${escapeXml(composer)}</creator></identification>` +
    '<part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>' +
    `<part id="P1">${measures.join('')}</part>` +
    '</score-partwise>'
  );
}
