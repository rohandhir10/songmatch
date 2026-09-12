import { songs, type Song } from "./songs.ts";

export type PopularSong = Song & {
  // True = approximate range from public knowledge (keys, live footage,
  // sheet-music folklore), open to community correction. False = measured
  // from our own catalogue data. Ranges and keys are facts, not
  // copyrightable expression — no licensed content lives here.
  rangeEstimate: boolean;
};

const estimate = (
  id: string,
  title: string,
  artist: string,
  key: Song["key"],
  vocalLowMidi: number,
  vocalHighMidi: number,
  difficulty: Song["difficulty"]
): PopularSong => {
  const span = vocalHighMidi - vocalLowMidi;
  return {
    id,
    title,
    artist,
    key,
    vocalLowMidi,
    vocalHighMidi,
    tessituraLowMidi: vocalLowMidi + Math.round(span * 0.2),
    tessituraHighMidi: vocalHighMidi - Math.round(span * 0.2),
    difficulty,
    rangeEstimate: true,
  };
};

export const popularSongs: PopularSong[] = [
  // Our own catalogue data first — exact, not estimates.
  ...songs.map((s) => ({ ...s, rangeEstimate: false })),

  // Popular tracks people actually want to sing. Ranges are conservative
  // approximations: sing the middle with confidence, treat the edges as
  // guidance until the community corrects them.
  estimate("let-it-be", "Let It Be", "The Beatles", "C", 53, 72, "Easy"),
  estimate("imagine", "Imagine", "John Lennon", "C", 48, 65, "Easy"),
  estimate("stand-by-me", "Stand By Me", "Ben E. King", "A", 45, 59, "Easy"),
  estimate("wonderwall", "Wonderwall", "Oasis", "F#", 54, 69, "Medium"),
  estimate("hey-jude", "Hey Jude", "The Beatles", "F", 55, 72, "Medium"),
  estimate(
    "someone-like-you-adele",
    "Someone Like You",
    "Adele",
    "A",
    55,
    76,
    "Hard"
  ),
  estimate(
    "rolling-in-the-deep",
    "Rolling in the Deep",
    "Adele",
    "C",
    50,
    74,
    "Hard"
  ),
  estimate("shape-of-you", "Shape of You", "Ed Sheeran", "C#", 47, 69, "Medium"),
];
