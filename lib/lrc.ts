export type LrcLine = {
  t: number;
  text: string;
};

export type LrcSong = {
  title: string | null;
  artist: string | null;
  lines: LrcLine[];
};

const TAG = /^\[(ar|ti|al|by|offset):(.*)\]$/i;
const TIMES = /\[(\d+:)?(\d+):(\d+(?:\.\d+)?)\]/g;

// Parses LRC lyric sheets the user supplies for their own audio files.
// We only ever display words the user provides (or public-domain /
// original lyrics we author) — never scraped copyrighted lyrics.
export function parseLrc(text: string): LrcSong {
  let title: string | null = null;
  let artist: string | null = null;
  const lines: LrcLine[] = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const tag = line.match(TAG);
    if (tag) {
      const value = tag[2].trim();
      if (tag[1].toLowerCase() === "ti" && value) title = value;
      if (tag[1].toLowerCase() === "ar" && value) artist = value;
      continue;
    }

    const times: number[] = [];
    let m: RegExpExecArray | null;
    TIMES.lastIndex = 0;
    while ((m = TIMES.exec(line)) !== null) {
      const hours = m[1] ? parseInt(m[1].slice(0, -1), 10) : 0;
      const t =
        hours * 3600 + parseInt(m[2], 10) * 60 + parseFloat(m[3]);
      if (Number.isFinite(t)) times.push(t);
    }
    if (times.length === 0) continue;

    const lyricText = line.replace(TIMES, "").trim();
    if (!lyricText) continue;

    for (const t of times) {
      lines.push({ t, text: lyricText });
    }
  }

  lines.sort((a, b) => a.t - b.t);
  return { title, artist, lines };
}

// Current line at playback time t, plus the upcoming line for anticipating
// the next phrase. Duplicate timestamps resolve to the last one in file.
export function activeLyric(
  song: LrcSong,
  t: number
): { text: string; next: string | null } | null {
  const lines = song.lines;
  if (lines.length === 0 || t < lines[0].t) return null;

  let current = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].t <= t) current = i;
    else break;
  }
  return {
    text: lines[current].text,
    next: current + 1 < lines.length ? lines[current + 1].text : null,
  };
}
