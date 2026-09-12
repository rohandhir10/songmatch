// Pure gating rules: what free users get vs Pro. No native imports so
// this stays unit-testable — the RevenueCat wrapper lives separately.
export const FREE_SONG_COUNT = 8;
export const FREE_EXERCISE_IDS = ["siren-glide"];

export function canSingSong(isPro: boolean, songIndex: number): boolean {
  return isPro || songIndex < FREE_SONG_COUNT;
}

export function canTrainExercise(isPro: boolean, exerciseId: string): boolean {
  return isPro || FREE_EXERCISE_IDS.includes(exerciseId);
}

export function paywallCopy(item: "songs" | "training"): {
  title: string;
  body: string;
} {
  if (item === "songs") {
    return {
      title: "Unlock all 100 songs",
      body: "The first 8 are on us. Pro opens the full shelf across all 8 genres — plus every future drop.",
    };
  }
  return {
    title: "Unlock the full gym",
    body: "The Siren Glide is free forever. Pro opens every drill, plan and future workout.",
  };
}
