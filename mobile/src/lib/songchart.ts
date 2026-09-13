// Hum-to-tiles: the singer charts a shelf song themselves. YouTube audio
// is untouchable, so the reference melody comes from the singer humming
// along once (earbuds in, mic hears only them). The chart is honestly
// labeled "your version" — their memory of the melody, not the record.
// Stored per song on-device; shared charts need accounts (future).

export type ChartNote = {
  start: number;
  end: number;
  midi: number;
};

export type ChartHit = ChartNote & {
  hit: boolean;
  coverage: number;
};

const MIN_NOTE_S = 0.12;
const SPLIT_CENTS = 100;
const HIT_CENTS = 60;

function hzToMidi(hz: number): number {
  return Math.round(12 * Math.log2(hz / 440) + 69);
}

// Same quantization physics as lib/notes contourToNotes, over a hummed
// pass (no nulls — unvoiced frames never enter sung samples).
export function buildChart(
  sung: Array<{ t: number; hz: number }>
): ChartNote[] {
  const notes: ChartNote[] = [];
  const voiced = sung.filter((p) => p.hz > 0);
  if (voiced.length === 0) return notes;

  let start = voiced[0].t;
  let midis: number[] = [hzToMidi(voiced[0].hz)];
  let lastT = voiced[0].t;

  const flush = (end: number) => {
    if (midis.length === 0) return;
    if (end - start < MIN_NOTE_S) return;
    const sorted = [...midis].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const last = notes[notes.length - 1];
    if (last && last.midi === median && start - last.end < 0.2) {
      last.end = end;
    } else {
      notes.push({ start, end, midi: median });
    }
  };

  for (let i = 1; i < voiced.length; i++) {
    const p = voiced[i];
    const gap = p.t - lastT;
    const midi = hzToMidi(p.hz);
    const center =
      [...midis].sort((a, b) => a - b)[Math.floor(midis.length / 2)];
    if (gap > 0.3 || Math.abs(midi - center) * 100 >= SPLIT_CENTS) {
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

// A chart note is HIT when ≥40% of its window was sung within ±60¢.
export function scoreVsChart(
  chart: ChartNote[],
  sung: Array<{ t: number; hz: number }>
): ChartHit[] {
  return chart.map((n) => {
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

export function chartKey(songId: string | null, videoId: string): string {
  return `songmatch-chart:${songId ?? `link:${videoId}`}`;
}
