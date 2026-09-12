export type PerformanceEntry = {
  songId: string;
  songTitle: string;
  accuracy: number;
  grade: "S" | "A" | "B" | "C" | "D";
  framesInside: number;
  framesTotal: number;
  at: number;
};

const MAX_ENTRIES = 100;

export const HISTORY_KEY = "songmatch-history";

export function recordPerformance(
  history: PerformanceEntry[],
  entry: PerformanceEntry
): PerformanceEntry[] {
  return [entry, ...history].slice(0, MAX_ENTRIES);
}

export function bestBySong(
  history: PerformanceEntry[]
): Map<string, PerformanceEntry> {
  const best = new Map<string, PerformanceEntry>();
  for (const e of history) {
    const cur = best.get(e.songId);
    if (!cur || e.accuracy > cur.accuracy) best.set(e.songId, e);
  }
  return best;
}

function startOfDay(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// Consecutive days with at least one session, counting back from today.
// A session yesterday keeps the streak alive; anything older breaks it.
export function dayStreak(history: PerformanceEntry[]): number {
  if (history.length === 0) return 0;
  const days = new Set(history.map((e) => startOfDay(e.at)));
  const today = startOfDay(Date.now());
  const dayMs = 24 * 60 * 60 * 1000;

  if (!days.has(today) && !days.has(today - dayMs)) return 0;

  let streak = 0;
  let cursor = days.has(today) ? today : today - dayMs;
  while (days.has(cursor)) {
    streak += 1;
    cursor -= dayMs;
  }
  return streak;
}
