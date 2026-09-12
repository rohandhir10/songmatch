// Song contour → discrete note blocks (the StarMaker moment).
// A reference pitch contour is quantized into sung notes: steady regions
// become one block each, silence or jumps over a semitone split them, and
// blips shorter than a 16th note are dropped. Vibrato (±50¢ wobble around
// a center) never splits a note.

export type NoteBlock = {
  start: number; // seconds
  end: number; // seconds
  midi: number; // quantized pitch
};

export type NoteHit = NoteBlock & {
  hit: boolean;
  coverage: number; // 0..1 fraction of the block sung within ±60¢
};

const MIN_NOTE_S = 0.12; // shorter than a 16th note at 120bpm
const SPLIT_CENTS = 100; // a semitone jump starts a new block
const HIT_CENTS = 60; // sung pitch within this of the block counts

function hzToMidi(hz: number): number {
  return Math.round(12 * Math.log2(hz / 440) + 69);
}

export function contourToNotes(
  contour: Array<{ t: number; hz: number }>
): NoteBlock[] {
  const notes: NoteBlock[] = [];
  if (contour.length === 0) return notes;

  let start = contour[0].t;
  let midis: number[] = [hzToMidi(contour[0].hz)];
  let lastT = contour[0].t;

  const flush = (end: number) => {
    if (midis.length === 0) return;
    const dur = end - start;
    if (dur < MIN_NOTE_S) return;
    const sorted = [...midis].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const last = notes[notes.length - 1];
    if (last && last.midi === median && start - last.end < 0.15) {
      last.end = end; // rejoin across a tiny gap
    } else {
      notes.push({ start, end, midi: median });
    }
  };

  for (let i = 1; i < contour.length; i++) {
    const p = contour[i];
    const gap = p.t - lastT;
    const midi = hzToMidi(p.hz);
    const center =
      [...midis].sort((a, b) => a - b)[Math.floor(midis.length / 2)];
    if (gap > 0.25 || Math.abs(midi - center) * 100 >= SPLIT_CENTS) {
      flush(lastT);
      start = p.t;
      midis = [midi];
    } else {
      midis.push(midi);
    }
    lastT = p.t;
  }
  flush(lastT);
  return notes;
}

// Scores each block against what the mic heard: a block is HIT when at
// least 40% of its window had voice within ±60¢ of its pitch.
export function scoreNoteHits(
  notes: NoteBlock[],
  sung: Array<{ t: number; hz: number }>
): NoteHit[] {
  return notes.map((n) => {
    const inWindow = sung.filter((s) => s.t >= n.start && s.t < n.end);
    if (inWindow.length === 0) return { ...n, hit: false, coverage: 0 };
    const target = 440 * Math.pow(2, (n.midi - 69) / 12);
    const good = inWindow.filter(
      (s) => Math.abs(1200 * Math.log2(s.hz / target)) <= HIT_CENTS
    ).length;
    const coverage = good / inWindow.length;
    return { ...n, hit: coverage >= 0.4, coverage };
  });
}
