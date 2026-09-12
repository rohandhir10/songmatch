export type Song = {
  id: string;
  title: string;
  artist: string;
  key: string;

  vocalLowMidi: number;
  vocalHighMidi: number;

  tessituraLowMidi: number;
  tessituraHighMidi: number;

  difficulty: "Easy" | "Medium" | "Hard";
};

export const songs: Song[] = [
  {
    id: "perfect",
    title: "Perfect",
    artist: "Ed Sheeran",
    key: "G",

    vocalLowMidi: 55,
    vocalHighMidi: 71,

    tessituraLowMidi: 59,
    tessituraHighMidi: 67,

    difficulty: "Easy",
  },

  {
    id: "until-i-found-you",
    title: "Until I Found You",
    artist: "Stephen Sanchez",
    key: "A",

    vocalLowMidi: 57,
    vocalHighMidi: 69,

    tessituraLowMidi: 60,
    tessituraHighMidi: 67,

    difficulty: "Easy",
  },

  {
    id: "all-of-me",
    title: "All of Me",
    artist: "John Legend",
    key: "C",

    vocalLowMidi: 48,
    vocalHighMidi: 72,

    tessituraLowMidi: 53,
    tessituraHighMidi: 67,

    difficulty: "Medium",
  },

  {
    id: "someone-you-loved",
    title: "Someone You Loved",
    artist: "Lewis Capaldi",
    key: "C",

    vocalLowMidi: 48,
    vocalHighMidi: 69,

    tessituraLowMidi: 53,
    tessituraHighMidi: 65,

    difficulty: "Medium",
  },

  {
    id: "tum-hi-ho",
    title: "Tum Hi Ho",
    artist: "Arijit Singh",
    key: "C",

    vocalLowMidi: 48,
    vocalHighMidi: 71,

    tessituraLowMidi: 52,
    tessituraHighMidi: 67,

    difficulty: "Medium",
  },

  {
    id: "as-it-was",
    title: "As It Was",
    artist: "Harry Styles",
    key: "F",

    vocalLowMidi: 48,
    vocalHighMidi: 64,

    tessituraLowMidi: 52,
    tessituraHighMidi: 62,

    difficulty: "Easy",
  },

  {
    id: "stay-with-me",
    title: "Stay With Me",
    artist: "Sam Smith",
    key: "C",

    vocalLowMidi: 48,
    vocalHighMidi: 70,

    tessituraLowMidi: 53,
    tessituraHighMidi: 67,

    difficulty: "Medium",
  },

  {
    id: "someone-like-you",
    title: "Someone Like You",
    artist: "Adele",
    key: "A",

    vocalLowMidi: 57,
    vocalHighMidi: 72,

    tessituraLowMidi: 60,
    tessituraHighMidi: 69,

    difficulty: "Medium",
  },
];
