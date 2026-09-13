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
