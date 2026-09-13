// Per-song lyric-sync offset: nudges LRC timings onto the video.
// Pure helpers — the page owns React state, this owns the math.

export const OFFSET_MIN = -10;
export const OFFSET_MAX = 10;
export const OFFSET_STEP = 0.5;

export function clampOffset(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(OFFSET_MIN, Math.min(OFFSET_MAX, v));
}

export function stepOffset(current: number, dir: 1 | -1): number {
  const v = +(current + dir * OFFSET_STEP).toFixed(1);
  return clampOffset(v);
}

export function offsetKey(songId: string | null, videoId: string): string {
  return `songmatch-offset:${songId ?? `link:${videoId}`}`;
}

export function loadOffset(
  store: { getItem(k: string): string | null },
  songId: string | null,
  videoId: string
): number {
  try {
    const raw = store.getItem(offsetKey(songId, videoId));
    return raw === null ? 0 : clampOffset(Number(raw));
  } catch {
    return 0;
  }
}

// Auto-sync: the singer's line onsets run a steady human delay behind the
// beat they aim at. Given observed (expected, actual) onset pairs, returns
// the offset delta that would put the median onset 0.4s after its tile —
// close enough to feel locked, loose enough to forgive slow starters.
// Null when fewer than 3 lines observed.
export function suggestOffset(
  onsets: Array<{ expected: number; actual: number }>
): number | null {
  if (onsets.length < 3) return null;
  const lags = onsets
    .map((o) => o.actual - o.expected)
    .sort((a, b) => a - b);
  const median = lags[Math.floor(lags.length / 2)];
  if (!Number.isFinite(median)) return null;
  return clampOffset(Math.round((median - 0.4) * 10) / 10);
}
