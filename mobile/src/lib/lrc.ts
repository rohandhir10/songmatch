export type LrcLine = {
  t: number;
  text: string;
};

export type WordHit = {
  word: string;
  t: number;
};

export type LrcSong = {
  title: string | null;
  artist: string | null;
  lines: LrcLine[];
};

// Splits a lyric line into per-word start times for hit-the-word visuals.
// Standard LRC only carries line times, so words are distributed across
// the line window by character weight — an approximation, stated openly:
// words light in reading order as the line elapses. Lines without a
// following line get a 4s window.
export function wordTimings(
  line: LrcLine,
  nextStart: number | null
): WordHit[] {
  const words = line.text.split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return [];
  const end = nextStart !== null && nextStart > line.t ? nextStart : line.t + 4;
  const total = words.reduce((sum, w) => sum + w.length + 1, 0) - 1;
  const dur = Math.max(0.2, end - line.t);
  let cursor = 0;
  return words.map((word, i) => {
    const t = i === 0 ? line.t : line.t + (cursor / total) * dur;
    cursor += word.length + 1;
    return { word, t };
  });
}

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
