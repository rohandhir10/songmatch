import type { Song } from "./songs.ts";
import type { VocalProfile } from "./pitch.ts";
import { frequencyToMidi } from "./pitch.ts";
import { pitchSteadiness } from "./pitch.ts";

export type SongPerformance = {
  accuracy: number;
  grade: "S" | "A" | "B" | "C" | "D";
  rangeHold: number;
  steadiness: number;
  framesTotal: number;
};

function gradeFor(accuracy: number): SongPerformance["grade"] {
  return accuracy >= 90 ? "S"
    : accuracy >= 75 ? "A"
    : accuracy >= 60 ? "B"
    : accuracy >= 40 ? "C"
    : "D";
}

// Register-aware song scoring. Real songs move through registers — soft
// verses low, belted choruses high, texture shifts throughout — so one
// static comfort band can't be the target. This blends range-hold (are
// you near the song's home?) with steadiness (are you in control,
// wherever you are?): a steady belt above the tessitura still scores,
// while sliding around inside the range does not.
export function scoreSongPerformance(
  frequencies: number[],
  song: Song,
): SongPerformance | null {
  const frames = frequencies.filter(
    (f) => Number.isFinite(f) && f > 0
  );
  if (frames.length === 0) return null;

  const hold = scorePerformance(frames, song);
  const steady = pitchSteadiness(frames) ?? 0;
  const accuracy = Math.round(
    (hold ? hold.accuracy : 0) * 0.5 + steady * 0.5
  );

  return {
    accuracy,
    grade: gradeFor(accuracy),
    rangeHold: hold ? hold.accuracy : 0,
    steadiness: steady,
    framesTotal: frames.length,
  };
}

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
  song: Song,
): PerformanceScore | null {
  const frames = frequencies.filter(
    (f) => Number.isFinite(f) && f > 0,
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

  // New: the profile used for the match, so callers can render
  // comfortable-range vs touched-edges info alongside the score.
  profileUsed: {
    comfortableLowMidi: number;
    comfortableHighMidi: number;
    tessituraLowMidi: number;
    tessituraHighMidi: number;
    tessituraCenterMidi: number;
  };
};

function overlapScore(
  userLow: number,
  userHigh: number,
  songLow: number,
  songHigh: number,
): number {
  const start = Math.max(userLow, songLow);
  const end = Math.min(userHigh, songHigh);

  if (end <= start) {
    return 0;
  }

  const overlap = end - start;
  const songRange = songHigh - songLow;

  // If the song is narrower than a semitone (bad data), fall back to a
  // point-in-band check instead of dividing by near-zero.
  if (songRange < 1) {
    const center = (songLow + songHigh) / 2;
    return userLow <= center && userHigh >= center ? 1 : 0;
  }

  return Math.min(1, overlap / songRange);
}

function calculateTranspose(
  userLow: number,
  userHigh: number,
  songLow: number,
  songHigh: number,
): number {
  const userCenter = (userLow + userHigh) / 2;
  const songCenter = (songLow + songHigh) / 2;

  return Math.round(userCenter - songCenter);
}

export function matchSong(
  profile: VocalProfile,
  song: Song,
): SongMatch {
  // Range coverage: does the song fit inside the RANGE you can actually hold?
  // Use the comfortable band (not the outer touched edges) so a brief falsetto
  // pop at the top doesn't make a hard song look easy.
  const rangeScore =
    overlapScore(
      profile.comfortableLowMidi,
      profile.comfortableHighMidi,
      song.vocalLowMidi,
      song.vocalHighMidi,
    ) * 100;

  // Tessitura fit: does the song LIVE where you sound best? This is the more
  // meaningful number for "does this feel like you." Use the measured tessitura
  // band rather than the old 20%-of-span heuristic.
  const tessituraScore =
    overlapScore(
      profile.tessituraLowMidi,
      profile.tessituraHighMidi,
      song.tessituraLowMidi,
      song.tessituraHighMidi,
    ) * 100;

  // Difficulty: harder songs expect more range + control. A tight consistency
  // profile should be rewarded (they can handle a wide zone); a wandering one
  // should be penalized on hard songs.
  let difficultyScore = 100;

  if (song.difficulty === "Medium") {
    difficultyScore = profile.consistency >= 65 ? 90 : 82;
  }

  if (song.difficulty === "Hard") {
    if (profile.consistency >= 70 && rangeScore >= 75) {
      difficultyScore = 88;
    } else if (profile.consistency >= 55) {
      difficultyScore = 76;
    } else {
      difficultyScore = 64;
    }
  }

  const score = Math.round(
    Math.max(
      0,
      Math.min(
        99,
        rangeScore * 0.40 +
          tessituraScore * 0.45 +
          difficultyScore * 0.15,
      ),
    ),
  );

  // Recommended transpose: match the song's tessitura to the user's tessitura
  // center, not their raw extremes. This keeps the key where the voice sounds
  // best rather than where it just barely reaches.
  const recommendedTranspose =
    calculateTranspose(
      profile.tessituraLowMidi,
      profile.tessituraHighMidi,
      song.tessituraLowMidi,
      song.tessituraHighMidi,
    );

  let explanation =
    "Some of this song may require a key adjustment.";

  if (tessituraScore >= 85) {
    explanation =
      "Excellent fit — the song lives in your comfortable zone.";
  } else if (tessituraScore >= 65) {
    explanation =
      "Good fit — most of the song sits where you sound best.";
  } else if (rangeScore >= 80) {
    explanation =
      "The song fits your range, but sits outside your most comfortable band.";
  } else if (rangeScore >= 55) {
    explanation =
      "You can reach this song's notes, but some parts will stretch you.";
  } else {
    explanation =
      "This song lives mostly outside your comfortable range.";
  }

  if (Math.abs(recommendedTranspose) >= 2) {
    explanation += ` Recommended key change: ${
      recommendedTranspose > 0 ? "+" : ""
    }${recommendedTranspose} semitones.`;
  }

  // If the profile is low-signal, be honest about it.
  if (profile.signalRatio < 30) {
    explanation += " Your scan was brief — re-scan for a more accurate match.";
  }

  return {
    song,
    score,
    rangeScore: Math.round(rangeScore),
    tessituraScore: Math.round(tessituraScore),
    difficultyScore,
    recommendedTranspose,
    explanation,
    profileUsed: {
      comfortableLowMidi: profile.comfortableLowMidi,
      comfortableHighMidi: profile.comfortableHighMidi,
      tessituraLowMidi: profile.tessituraLowMidi,
      tessituraHighMidi: profile.tessituraHighMidi,
      tessituraCenterMidi: profile.tessituraCenterMidi,
    },
  };
}

export function matchSongs(
  profile: VocalProfile,
  songList: Song[],
): SongMatch[] {
  return songList
    .map((song) => matchSong(profile, song))
    .sort((a, b) => b.score - a.score);
}
