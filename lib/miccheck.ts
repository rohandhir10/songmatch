export type BleedCheck = {
  bleed: boolean;
  voicedRatio: number;
  framesAnalyzed: number;
};

// Decides whether the mic is hearing the room (track bleeding from
// speakers) instead of silence. Run while the user stays quiet with the
// song playing: if the detector keeps finding confident pitch, that's the
// track leaking in — and any later "performance" would just trace the song.
export function analyzeSilence(
  frames: Array<number | null>,
  bleedThreshold = 0.4,
  minFrames = 20
): BleedCheck {
  const analyzed = frames.slice(0, Math.max(frames.length, 0));
  if (analyzed.length < minFrames) {
    return { bleed: false, voicedRatio: 0, framesAnalyzed: analyzed.length };
  }
  const voiced = analyzed.filter(
    (f) => f !== null && Number.isFinite(f) && f >= 70 && f <= 800
  ).length;
  const ratio = voiced / analyzed.length;
  return { bleed: ratio > bleedThreshold, voicedRatio: ratio, framesAnalyzed: analyzed.length };
}
