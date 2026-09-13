// Built-in songs: public-domain melodies with note charts and lyrics,
// performed with on-device synth backing. No streams, no files, no
// licenses — open the app and sing. Melodies below are the canonical
// folk versions (Happy Birthday's melody is PD worldwide since 2016;
// Twinkle/áshoz and Ode to Joy centuries old). Syllables ride each note.

import type { ChartNote } from "./songchart.ts";

export type PDNote = {
  beat: number; // start in beats
  beats: number; // length in beats
  midi: number;
  lyric: string;
};

export type PDSong = {
  id: string;
  title: string;
  origin: string;
  bpm: number;
  notes: PDNote[];
};

const HB: Array<[number, number, number, string]> = [
  // beat, beats, midi, lyric — Happy Birthday, key G
  [0.5, 0.5, 62, "Hap-"], [1, 0.5, 62, "py"], [1.5, 1, 64, "birth-"],
  [2.5, 1, 62, "day"], [3.5, 1, 67, "to"], [4.5, 2, 66, "you"],
  [5.5, 0.5, 62, "Hap-"], [6, 0.5, 62, "py"], [6.5, 1, 64, "birth-"],
  [7.5, 1, 62, "day"], [8.5, 1, 69, "to"], [9.5, 2, 67, "you"],
  [10.5, 0.5, 62, "Hap-"], [11, 0.5, 62, "py"], [11.5, 1, 74, "birth-"],
  [12.5, 1, 71, "day"], [13.5, 1, 67, "dear"], [14.5, 1, 66, "A-"],
  [15.5, 2, 64, "-sha"],
  [16.5, 0.5, 70, "Hap-"], [17, 0.5, 70, "py"], [17.5, 1, 69, "birth-"],
  [18.5, 1, 67, "day"], [19.5, 1, 69, "to"], [20.5, 2.5, 67, "you"],
];

const TW: Array<[number, number, number, string]> = [
  // Twinkle Twinkle, key C — first verse
  [0, 1, 60, "Twin-"], [1, 1, 60, "kle"], [2, 1, 67, "twin-"],
  [3, 1, 67, "kle"], [4, 1, 69, "lit-"], [5, 1, 69, "tle"],
  [6, 2, 67, "star"],
  [8, 1, 65, "How"], [9, 1, 65, "I"], [10, 1, 64, "won-"],
  [11, 1, 64, "der"], [12, 1, 62, "what"], [13, 1, 62, "you"],
  [14, 2, 60, "are"],
];

const ODE: Array<[number, number, number, string]> = [
  // Ode to Joy, key D
  [0, 1, 66, "Joy-"], [1, 1, 66, "ful"], [2, 1, 67, "joy-"],
  [3, 1, 69, "ful"], [4, 1, 69, "joy-"], [5, 1, 67, "ful"],
  [6, 1, 66, "joy-"], [7, 1, 64, "ful"], [8, 1, 62, "dawn"],
  [9, 1, 62, "of"], [10, 1, 64, "free-"], [11, 1, 66, "-dom"],
  [12, 1.5, 66, "sing"], [13.5, 0.5, 64, "a-"], [14, 2, 64, "-loud"],
];

function build(
  id: string,
  title: string,
  origin: string,
  bpm: number,
  raw: Array<[number, number, number, string]>
): PDSong {
  return {
    id,
    title,
    origin,
    bpm,
    notes: raw.map(([beat, beats, midi, lyric]) => ({
      beat,
      beats,
      midi,
      lyric,
    })),
  };
}

export const PD_SONGS: PDSong[] = [
  build("happy-birthday", "Happy Birthday", "Traditional · PD worldwide", 100, HB),
  build("twinkle", "Twinkle Twinkle Little Star", "Ah vous dirai-je, Maman · 1761", 92, TW),
  build("ode-to-joy", "Ode to Joy", "Beethoven · 1824", 96, ODE),
];

const LEAD = 1.2; // count-in bar before the first note

export function pdToChart(song: PDSong): ChartNote[] {
  const spb = 60 / song.bpm;
  return song.notes.map((n) => ({
    start: LEAD + n.beat * spb,
    end: LEAD + (n.beat + n.beats) * spb,
    midi: n.midi,
  }));
}

export function pdLeadSeconds(): number {
  return LEAD;
}
