import type { Song } from "./songs";
import type { VocalProfile } from "./pitch";

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
