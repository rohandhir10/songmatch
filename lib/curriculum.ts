// Training curriculum: plans → daily lessons → certificates.
// Progress derives from the training history the app already records
// (train:<exerciseId> entries), so plans work with zero new tracking.
// A plan starts when the user taps Start (timestamp in localStorage);
// only sessions after that count. Song lessons accept any shelf take.

import type { PerformanceEntry } from "./history.ts";

export type Lesson = {
  day: number;
  title: string;
  kind: "exercise" | "song";
  exerciseId?: string;
  goal: number; // accuracy % that checks the lesson off
};

export type Plan = {
  id: string;
  title: string;
  tagline: string;
  lessons: Lesson[];
};

export const PLANS: Plan[] = [
  {
    id: "first-week",
    title: "First-Week Singer",
    tagline: "Seven days from curious to in-tune: one drill a day.",
    lessons: [
      { day: 1, title: "Find your slide", kind: "exercise", exerciseId: "siren-glide", goal: 50 },
      { day: 2, title: "Walk the scale", kind: "exercise", exerciseId: "major-scale-c", goal: 50 },
      { day: 3, title: "Jump thirds", kind: "exercise", exerciseId: "third-jumps", goal: 50 },
      { day: 4, title: "Climb triads", kind: "exercise", exerciseId: "triad-ladder", goal: 55 },
      { day: 5, title: "Hold the octave", kind: "exercise", exerciseId: "octave-hold", goal: 55 },
      { day: 6, title: "Slide with control", kind: "exercise", exerciseId: "siren-glide", goal: 65 },
      { day: 7, title: "Perform any shelf song", kind: "song", goal: 40 },
    ],
  },
  {
    id: "range-builder",
    title: "Range Builder",
    tagline: "Three weeks to stretch your edges without strain.",
    lessons: [
      { day: 1, title: "Easy slides", kind: "exercise", exerciseId: "siren-glide", goal: 60 },
      { day: 3, title: "Scale, slowly", kind: "exercise", exerciseId: "major-scale-c", goal: 60 },
      { day: 5, title: "Thirds at tempo", kind: "exercise", exerciseId: "third-jumps", goal: 60 },
      { day: 7, title: "Triads tall", kind: "exercise", exerciseId: "triad-ladder", goal: 65 },
      { day: 9, title: "Octave holds", kind: "exercise", exerciseId: "octave-hold", goal: 65 },
      { day: 11, title: "Slides at 75", kind: "exercise", exerciseId: "siren-glide", goal: 75 },
      { day: 13, title: "Scale at 75", kind: "exercise", exerciseId: "major-scale-c", goal: 75 },
      { day: 15, title: "Triads at 80", kind: "exercise", exerciseId: "triad-ladder", goal: 80 },
      { day: 17, title: "Hold the octave at 80", kind: "exercise", exerciseId: "octave-hold", goal: 80 },
      { day: 21, title: "Graduation song", kind: "song", goal: 60 },
    ],
  },
];

export function planStartsKey(): string {
  return "songmatch-plan-starts";
}

function matchId(lesson: Lesson): string | null {
  if (lesson.kind === "exercise" && lesson.exerciseId) {
    return `train:${lesson.exerciseId}`;
  }
  return null; // song lessons match any shelf take below
}

// Best accuracy for this lesson since the plan started.
export function lessonStatus(
  history: PerformanceEntry[],
  lesson: Lesson,
  since: number
): { done: boolean; best: number | null } {
  const fresh = history.filter((e) => e.at >= since);
  let cands: PerformanceEntry[];
  if (lesson.kind === "song") {
    cands = fresh.filter(
      (e) => e.songId.startsWith("yt:") || e.songId.startsWith("file:")
    );
  } else {
    const id = matchId(lesson);
    cands = id ? fresh.filter((e) => e.songId === id) : [];
  }
  if (cands.length === 0) return { done: false, best: null };
  const best = Math.max(...cands.map((e) => e.accuracy));
  return { done: best >= lesson.goal, best };
}

export function planProgress(
  plan: Plan,
  history: PerformanceEntry[],
  since: number
): { done: number; open: number; complete: boolean } {
  let done = 0;
  for (const l of plan.lessons) {
    if (lessonStatus(history, l, since).done) done++;
  }
  return {
    done,
    open: plan.lessons.length - done,
    complete: done === plan.lessons.length,
  };
}
