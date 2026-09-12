import type { Song } from "./songs.ts";
import type { VocalProfile } from "./pitch.ts";
import { frequencyToMidi } from "./pitch.ts";

export type PerformanceScore = {
  accuracy: number;
  grade: "S" | "A" | "B" | "C" | "D";
  framesInside: number;
  framesTotal: number;
};

// Scores a performance: full credit for frames sung inside the song's
// tessitura (where the song mostly lives), half credit inside the outer
// vocal range, none outside. Honest without a melody timeline — it measures
// range control, not note-by-note correctness.
export function scorePerformance(
  frequencies: number[],
  song: Song
): PerformanceScore | null {
  const frames = frequencies.filter(
    (f) => Number.isFinite(f) && f > 0
  );
  if (frames.length === 0) return null;

  let credit = 0;
  let inside = 0;
  for (const f of frames) {
    const midi = frequencyToMidi(f);
    if (midi >= song.tessituraLowMidi && midi <= song.tessituraHighMidi) {
      credit += 1;
      inside += 1;
    } else if (midi >= song.vocalLowMidi && midi <= song.vocalHighMidi) {
      credit += 0.5;
    }
  }

  const accuracy = Math.round((credit / frames.length) * 100);
  const grade =
    accuracy >= 90 ? "S"
    : accuracy >= 75 ? "A"
    : accuracy >= 60 ? "B"
    : accuracy >= 40 ? "C"
    : "D";

  return { accuracy, grade, framesInside: inside, framesTotal: frames.length };
}

export type SongMatch = {
  song: Song;

  score: number;

  rangeScore: number;

  tessituraScore: number;

  difficultyScore: number;

  recommendedTranspose: number;

  explanation: string;
};

function overlapScore(
  userLow: number,
  userHigh: number,
  songLow: number,
  songHigh: number
): number {
  const start = Math.max(userLow, songLow);
  const end = Math.min(userHigh, songHigh);

  if (end <= start) {
    return 0;
  }

  const overlap = end - start;
  const songRange = songHigh - songLow;

  return Math.min(1, overlap / songRange);
}

function calculateTranspose(
  userLow: number,
  userHigh: number,
  songLow: number,
  songHigh: number
): number {
  const userCenter = (userLow + userHigh) / 2;
  const songCenter = (songLow + songHigh) / 2;

  return Math.round(userCenter - songCenter);
}

export function matchSong(
  profile: VocalProfile,
  song: Song
): SongMatch {
  const rangeScore =
    overlapScore(
      profile.minMidi,
      profile.maxMidi,
      song.vocalLowMidi,
      song.vocalHighMidi
    ) * 100;

  const tessituraScore =
    overlapScore(
      profile.minMidi,
      profile.maxMidi,
      song.tessituraLowMidi,
      song.tessituraHighMidi
    ) * 100;

  let difficultyScore = 100;

  if (song.difficulty === "Medium") {
    difficultyScore = 88;
  }

  if (song.difficulty === "Hard") {
    difficultyScore = 72;
  }

  const score = Math.round(
    Math.max(
      0,
      Math.min(
        99,
        rangeScore * 0.45 +
          tessituraScore * 0.45 +
          difficultyScore * 0.1
      )
    )
  );

  const recommendedTranspose =
    calculateTranspose(
      profile.minMidi,
      profile.maxMidi,
      song.vocalLowMidi,
      song.vocalHighMidi
    );

  let explanation =
    "Some of this song may require a key adjustment.";

  if (tessituraScore >= 85) {
    explanation =
      "Excellent fit — most of the song sits inside your comfortable range.";
  } else if (rangeScore >= 70) {
    explanation =
      "Good fit — most of the song sits inside your usable range.";
  }

  if (Math.abs(recommendedTranspose) >= 2) {
    explanation += ` Recommended key change: ${
      recommendedTranspose > 0 ? "+" : ""
    }${recommendedTranspose} semitones.`;
  }

  return {
    song,
    score,
    rangeScore: Math.round(rangeScore),
    tessituraScore: Math.round(tessituraScore),
    difficultyScore,
    recommendedTranspose,
    explanation,
  };
}

export function matchSongs(
  profile: VocalProfile,
  songList: Song[]
): SongMatch[] {
  return songList
    .map((song) => matchSong(profile, song))
    .sort((a, b) => b.score - a.score);
}
