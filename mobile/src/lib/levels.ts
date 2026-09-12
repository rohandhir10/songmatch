import type { Song } from "./songs.ts";

export type Level = "Easy" | "Standard" | "Hard";

// Leveled arrangements without audio files: the scored focus zone narrows
// per level, like Yousician's rewritten charts. Easy scores the song's
// middle (verse range) so beginners aren't graded on belts they can't
// reach; Standard uses the full tessitura; Hard adds the outer vocal
// range edges. Same scorer, different zone.
export function focusBand(song: Song, level: Level): {
  lowMidi: number;
  highMidi: number;
} {
  if (level === "Easy") {
    const span = song.tessituraHighMidi - song.tessituraLowMidi;
    const pad = Math.max(1, Math.round(span * 0.25));
    return {
      lowMidi: song.tessituraLowMidi + pad,
      highMidi: song.tessituraHighMidi - pad,
    };
  }
  if (level === "Hard") {
    return { lowMidi: song.vocalLowMidi, highMidi: song.vocalHighMidi };
  }
  return { lowMidi: song.tessituraLowMidi, highMidi: song.tessituraHighMidi };
}

// A derived "arrangement" of the song for the level: identical except the
// tessitura becomes the focus zone. scoreSongPerformance runs unchanged.
export function arrangeForLevel(song: Song, level: Level): Song {
  const band = focusBand(song, level);
  return {
    ...song,
    tessituraLowMidi: band.lowMidi,
    tessituraHighMidi: band.highMidi,
  };
}

// Suggest a starting level from how the song fits the singer: huge fit
// headroom → Hard, comfortable → Standard, stretch → Easy.
export function suggestLevel(rangeScore: number): Level {
  if (rangeScore >= 85) return "Hard";
  if (rangeScore >= 55) return "Standard";
  return "Easy";
}
