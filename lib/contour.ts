import { detectPitch } from "./pitch";

export type ContourPoint = {
  t: number;
  freq: number | null;
};

export type ReferenceContour = {
  points: ContourPoint[];
  hopSeconds: number;
};

export type LiveFrame = {
  t: number;
  freq: number;
};

export type ContourScore = {
  meanAbsCents: number;
  grade: "S" | "A" | "B" | "C" | "D";
  framesScored: number;
  coverage: number;
};

// True target-note scoring: mean absolute cents between the live voice
// and the reference contour at the same playback time. Live frames where
// the reference is unvoiced (gaps, breaths) don't count either way.
export function scoreAgainstContour(
  live: LiveFrame[],
  ref: ReferenceContour
): ContourScore | null {
  const pts = ref.points;
  if (pts.length === 0) return null;

  let absSum = 0;
  let scored = 0;
  for (const frame of live) {
    if (!Number.isFinite(frame.freq) || frame.freq <= 0) continue;
    // Nearest contour point in time
    let lo = 0;
    let hi = pts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (pts[mid].t < frame.t) lo = mid + 1;
      else hi = mid;
    }
    let best = lo;
    if (lo > 0 && Math.abs(pts[lo - 1].t - frame.t) < Math.abs(pts[lo].t - frame.t)) {
      best = lo - 1;
    }
    const refFreq = pts[best].freq;
    if (refFreq === null) continue;
    if (Math.abs(pts[best].t - frame.t) > ref.hopSeconds * 2) continue;
    absSum += Math.abs(1200 * Math.log2(frame.freq / refFreq));
    scored += 1;
  }

  if (scored === 0) return null;
  const meanAbsCents = absSum / scored;
  const grade =
    meanAbsCents <= 15 ? "S"
    : meanAbsCents <= 30 ? "A"
    : meanAbsCents <= 50 ? "B"
    : meanAbsCents <= 80 ? "C"
    : "D";

  return {
    meanAbsCents: Math.round(meanAbsCents * 10) / 10,
    grade,
    framesScored: scored,
    coverage: Math.round((scored / live.length) * 100),
  };
}

// Chunked async twin of extractContour: same core math, but yields to the
// UI thread every slice so the "Analyzing your song…" bar stays alive on
// multi-minute files.
export async function extractContourAsync(
  left: Float32Array,
  right: Float32Array,
  sampleRate: number,
  onProgress?: (done: number, total: number) => void,
  windowSize = 2048,
  hopSize = 1024
): Promise<ReferenceContour> {
  const mid = isolateCenterVocal(left, right);
  const hopSeconds = hopSize / sampleRate;
  const total = Math.max(0, Math.floor((mid.length - windowSize) / hopSize) + 1);
  const raw: Array<number | null> = [];
  const SLICE = 256;

  for (let h = 0; h < total; h++) {
    const o = h * hopSize;
    const f = detectPitch(mid.subarray(o, o + windowSize), sampleRate);
    raw.push(f >= 70 && f <= 800 ? f : null);
    if (h % SLICE === 0) {
      onProgress?.(h, total);
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  onProgress?.(total, total);

  const smoothed = raw.map((_, i) => {
    const w: number[] = [];
    for (let j = Math.max(0, i - 2); j <= Math.min(raw.length - 1, i + 2); j++) {
      if (raw[j] !== null) w.push(raw[j] as number);
    }
    if (w.length === 0) return null;
    w.sort((a, b) => a - b);
    return w[Math.floor(w.length / 2)];
  });

  const points: ContourPoint[] = smoothed.map((f, i) => {
    if (
      f !== null &&
      smoothed[Math.max(0, i - 1)] === null &&
      smoothed[Math.min(smoothed.length - 1, i + 1)] === null &&
      smoothed.length > 2
    ) {
      return { t: i * hopSeconds, freq: null };
    }
    return { t: i * hopSeconds, freq: f };
  });

  return { points, hopSeconds };
}

// Center-channel isolation: lead vocals sit centered (identical in L/R)
// while most accompaniment spreads wide. mid = (L+R)/2 keeps the centered
// vocal and halves the sides — the classic karaoke-remover in reverse.
export function isolateCenterVocal(
  left: Float32Array,
  right: Float32Array
): Float32Array {
  const n = Math.min(left.length, right.length);
  const mid = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    mid[i] = (left[i] + right[i]) / 2;
  }
  return mid;
}

// Extracts the reference vocal contour from the user's own stereo audio:
// isolate center → YIN per hop → median smoothing → drop single-hop blips.
// Runs once per song ("Analyzing..."), cached, then performance mode
// scrolls it by the playback clock. Nothing uploads anywhere.
export function extractContour(
  left: Float32Array,
  right: Float32Array,
  sampleRate: number,
  windowSize = 2048,
  hopSize = 1024
): ReferenceContour {
  const mid = isolateCenterVocal(left, right);
  const hopSeconds = hopSize / sampleRate;
  const raw: Array<number | null> = [];

  for (let o = 0; o + windowSize <= mid.length; o += hopSize) {
    const f = detectPitch(mid.subarray(o, o + windowSize), sampleRate);
    raw.push(f >= 70 && f <= 800 ? f : null);
  }

  // Median smooth over ±2 hops to kill single-window wobble
  const smoothed = raw.map((_, i) => {
    const w: number[] = [];
    for (let j = Math.max(0, i - 2); j <= Math.min(raw.length - 1, i + 2); j++) {
      if (raw[j] !== null) w.push(raw[j] as number);
    }
    if (w.length === 0) return null;
    w.sort((a, b) => a - b);
    return w[Math.floor(w.length / 2)];
  });

  // Drop isolated single-hop voiced blips (both neighbors unvoiced)
  const points: ContourPoint[] = smoothed.map((f, i) => {
    if (
      f !== null &&
      smoothed[Math.max(0, i - 1)] === null &&
      smoothed[Math.min(smoothed.length - 1, i + 1)] === null &&
      smoothed.length > 2
    ) {
      return { t: i * hopSeconds, freq: null };
    }
    return { t: i * hopSeconds, freq: f };
  });

  return { points, hopSeconds };
}
