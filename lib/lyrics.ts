// Crowdsourced synced lyrics (lrclib.net: free, no key, community
// contributions). Fetched at runtime on the user's device — like the
// YouTube embed, nothing copyrighted ships with the app. Results cache
// in localStorage per song; failures stay silent, the upload fallback
// in LyricsField always remains.

export type LrcSearchHit = {
  syncedLyrics?: string | null;
  plainLyrics?: string | null;
  duration?: number | null;
};

export function searchUrl(artist: string, title: string): string {
  const q = encodeURIComponent(`${artist} ${title}`.trim());
  return `https://lrclib.net/api/search?q=${q}`;
}

// Picks the best synced candidate: synced lines required, closest
// duration wins (covers, remixes and live versions share titles).
export function pickSynced(
  hits: LrcSearchHit[],
  durationHint?: number | null
): string | null {
  const synced = hits.filter(
    (h): h is LrcSearchHit & { syncedLyrics: string } =>
      typeof h.syncedLyrics === "string" && h.syncedLyrics.includes("[")
  );
  if (synced.length === 0) return null;
  if (durationHint == null) return synced[0].syncedLyrics;
  let best = synced[0];
  let bestGap = Math.abs((best.duration ?? durationHint) - durationHint);
  for (const h of synced.slice(1)) {
    const gap = Math.abs((h.duration ?? durationHint) - durationHint);
    if (gap < bestGap) {
      best = h;
      bestGap = gap;
    }
  }
  return best.syncedLyrics;
}

export async function fetchLrcText(
  artist: string,
  title: string,
  durationHint?: number | null
): Promise<string | null> {
  // Exact endpoint first (cheapest), search fallback for the rest.
  try {
    const exact = await fetch(
      `https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`
    );
    if (exact.ok) {
      const one = (await exact.json()) as LrcSearchHit;
      if (one.syncedLyrics) return one.syncedLyrics;
    }
  } catch {
    // fall through to search
  }
  try {
    const res = await fetch(searchUrl(artist, title));
    if (!res.ok) return null;
    const hits = (await res.json()) as LrcSearchHit[];
    if (!Array.isArray(hits)) return null;
    return pickSynced(hits, durationHint);
  } catch {
    return null;
  }
}

export function cachedLrc(key: string): string | null {
  try {
    return localStorage.getItem(`songmatch-lrc:${key}`);
  } catch {
    return null;
  }
}

export function cacheLrc(key: string, text: string): void {
  try {
    localStorage.setItem(`songmatch-lrc:${key}`, text);
  } catch {
    // Quota: fetch again next time.
  }
}
