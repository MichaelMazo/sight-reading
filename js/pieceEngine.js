// Playing through a piece in "wait" mode (no tempo): the cursor stays on a position
// until every required note there has been played, in any order.
// No DOM here.
//
// A position is { measure, time, notes: [{ midi, staff, tied, length }] }, time and
// length in whole notes. Staff 0 is the right
// hand, staff 1 (and below) the left. Tied notes continue a note already sounding,
// so they are never asked for again.

export class PieceSession {
  constructor(positions, hands = 'both') {
    this.positions = positions;
    this.setHands(hands);
    this.restart();
  }

  setHands(hands) {
    this.hands = hands;
    this.played = new Set();
  }

  isPlayedByUser(staff) {
    const hand = staff === 0 ? 'right' : 'left';
    return this.hands === 'both' || this.hands === hand;
  }

  restart() {
    this.index = 0;
    this.played = new Set();
    this.errors = 0;
  }

  get finished() {
    return this.index >= this.positions.length;
  }

  get position() {
    return this.positions[this.index];
  }

  get measureCount() {
    const last = this.positions[this.positions.length - 1];
    return last ? last.measure + 1 : 0;
  }

  get currentMeasure() {
    const i = Math.min(this.index, this.positions.length - 1);
    return this.positions[i]?.measure ?? 0;
  }

  // Notes the user has to play at position i.
  required(i = this.index) {
    const p = this.positions[i];
    if (!p) return new Set();
    return new Set(p.notes.filter((n) => !n.tied && this.isPlayedByUser(n.staff)).map((n) => n.midi));
  }

  // Notes of the other hand, which the app plays: [{ midi, length }].
  accompaniment(i = this.index) {
    const p = this.positions[i];
    if (!p) return [];
    return p.notes.filter((n) => !n.tied && !this.isPlayedByUser(n.staff));
  }

  missing() {
    return [...this.required()].filter((m) => !this.played.has(m));
  }

  // Returns 'wrong', 'partial' (right note, more to play here) or 'done' (position complete).
  press(midi) {
    if (this.finished) return 'ignored';
    const required = this.required();
    if (!required.has(midi)) {
      this.errors++;
      return 'wrong';
    }
    this.played.add(midi);
    if (this.missing().length) return 'partial';
    this.advance();
    return 'done';
  }

  advance() {
    this.index++;
    this.played = new Set();
  }

  // First press: back to the start of the current measure. When already there
  // (nothing played in this measure yet), go to the start of the previous one.
  back() {
    const measure = this.currentMeasure;
    const start = this.firstIndexOf(measure);
    if (!this.finished && this.index > this.firstPlayableIndexOf(measure)) {
      this.index = start;
    } else if (this.finished) {
      this.index = start;
    } else {
      this.index = start > 0 ? this.firstIndexOf(this.positions[start - 1].measure) : 0;
    }
    this.played = new Set();
  }

  firstIndexOf(measure) {
    return this.positions.findIndex((p) => p.measure === measure);
  }

  // Positions the app plays alone (other hand only) are skipped automatically,
  // so "already at the start" means at the first position the user has to play.
  firstPlayableIndexOf(measure) {
    const start = this.firstIndexOf(measure);
    for (let i = start; i < this.positions.length && this.positions[i].measure === measure; i++) {
      if (this.required(i).size) return i;
    }
    return start;
  }
}
