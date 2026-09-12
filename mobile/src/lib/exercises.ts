import type { ReferenceContour } from "./contour.ts";

export type ExerciseNote = {
  midi: number;
  beats: number;
};

export type Exercise = {
  id: string;
  title: string;
  goal: string;
  bpm: number;
  howTo: string;
  notes: ExerciseNote[];
};

export const exercises: Exercise[] = [
  {
    id: "siren-glide",
    title: "Siren Glide",
    goal: "Connect chest and head voice smoothly",
    bpm: 60,
    howTo:
      "Hum or lip-trill from your low comfortable note up to the top and back down, like a siren. No breaks, no pushing — follow the line.",
    notes: [
      { midi: 55, beats: 1 },
      { midi: 57, beats: 1 },
      { midi: 59, beats: 1 },
      { midi: 60, beats: 1 },
      { midi: 62, beats: 1 },
      { midi: 64, beats: 1 },
      { midi: 65, beats: 1 },
      { midi: 67, beats: 1 },
      { midi: 65, beats: 1 },
      { midi: 64, beats: 1 },
      { midi: 62, beats: 1 },
      { midi: 60, beats: 1 },
      { midi: 59, beats: 1 },
      { midi: 57, beats: 1 },
      { midi: 55, beats: 2 },
    ],
  },
  {
    id: "major-scale-c",
    title: "C Major Scale",
    goal: "Even tone across every step",
    bpm: 80,
    howTo:
      "Sing each note on 'ah', keeping the volume and brightness identical from bottom to top and back. The line shows where each step should sit.",
    notes: [
      { midi: 60, beats: 1 },
      { midi: 62, beats: 1 },
      { midi: 64, beats: 1 },
      { midi: 65, beats: 1 },
      { midi: 67, beats: 1 },
      { midi: 69, beats: 1 },
      { midi: 71, beats: 1 },
      { midi: 72, beats: 2 },
      { midi: 71, beats: 1 },
      { midi: 69, beats: 1 },
      { midi: 67, beats: 1 },
      { midi: 65, beats: 1 },
      { midi: 64, beats: 1 },
      { midi: 62, beats: 1 },
      { midi: 60, beats: 2 },
    ],
  },
  {
    id: "third-jumps",
    title: "Third Jumps",
    goal: "Land intervals cleanly without scooping",
    bpm: 70,
    howTo:
      "Jump between notes a third apart and land dead-center first try — no sliding up into the note. Short, confident onsets.",
    notes: [
      { midi: 60, beats: 1 },
      { midi: 64, beats: 1 },
      { midi: 62, beats: 1 },
      { midi: 65, beats: 1 },
      { midi: 64, beats: 1 },
      { midi: 67, beats: 1 },
      { midi: 65, beats: 1 },
      { midi: 69, beats: 2 },
      { midi: 67, beats: 1 },
      { midi: 64, beats: 1 },
      { midi: 65, beats: 1 },
      { midi: 62, beats: 1 },
      { midi: 64, beats: 1 },
      { midi: 60, beats: 2 },
    ],
  },
  {
    id: "triad-ladder",
    title: "Triad Ladder",
    goal: "Build chord-tone accuracy climbing upward",
    bpm: 72,
    howTo:
      "Climb do–mi–sol in three keys, back down after each peak. Keep each triad crisp — three distinct notes, not a smear.",
    notes: [
      { midi: 60, beats: 1 },
      { midi: 64, beats: 1 },
      { midi: 67, beats: 2 },
      { midi: 64, beats: 1 },
      { midi: 60, beats: 2 },
      { midi: 62, beats: 1 },
      { midi: 65, beats: 1 },
      { midi: 69, beats: 2 },
      { midi: 65, beats: 1 },
      { midi: 62, beats: 2 },
      { midi: 64, beats: 1 },
      { midi: 67, beats: 1 },
      { midi: 71, beats: 2 },
      { midi: 67, beats: 1 },
      { midi: 64, beats: 2 },
    ],
  },
  {
    id: "octave-hold",
    title: "Octave Hold",
    goal: "Hold the top note steady for a full breath",
    bpm: 60,
    howTo:
      "Step up one octave and hold the top note as still as glass for four beats. Watch the steadiness needle — still wins.",
    notes: [
      { midi: 60, beats: 1 },
      { midi: 64, beats: 1 },
      { midi: 67, beats: 1 },
      { midi: 72, beats: 4 },
      { midi: 67, beats: 1 },
      { midi: 64, beats: 1 },
      { midi: 60, beats: 3 },
    ],
  },
];

// Turns an exercise into the same ReferenceContour machinery the sing-along
// room uses — but exact, because we authored the timeline. Target-note
// scoring with zero audio files.
export function exerciseToContour(
  exercise: Exercise,
  pointsPerSecond = 60
): ReferenceContour {
  const beatSeconds = 60 / exercise.bpm;
  const points: ReferenceContour["points"] = [];
  let t = 0;
  for (const note of exercise.notes) {
    const freq = 440 * Math.pow(2, (note.midi - 69) / 12);
    const dur = note.beats * beatSeconds;
    const count = Math.max(1, Math.round(dur * pointsPerSecond));
    for (let i = 0; i < count; i++) {
      points.push({ t: t + (i / count) * dur, freq });
    }
    t += dur;
  }
  return { points, hopSeconds: 1 / pointsPerSecond };
}

export function exerciseDuration(exercise: Exercise): number {
  const beatSeconds = 60 / exercise.bpm;
  return exercise.notes.reduce((sum, n) => sum + n.beats * beatSeconds, 0);
}
