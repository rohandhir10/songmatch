export type BleedCheck = {
  bleed: boolean;
  voicedRatio: number;
  framesAnalyzed: number;
};

export type BleedMonitor = {
  suspect: boolean;
  voicedRatio: number;
  framesAnalyzed: number;
};

// Continuous watch for speaker bleed DURING a performance. A one-time gate
// can't catch bleed that starts later (quiet intro passes, vocals kick in
// mid-song; volume turned up after check). Signature of a bleeding mic:
// near-100% voicing with machine-low jitter over ~10s — human voices
// breathe, articulate consonants, and wobble; a track never does.
export function monitorBleed(
  frames: Array<number | null>,
  windowSize = 600,
  minFrames = 300
): BleedMonitor {
  const window = frames.slice(-windowSize);
  if (window.length < minFrames) {
    return { suspect: false, voicedRatio: 0, framesAnalyzed: window.length };
  }
  const voiced = window.filter(
    (f) => f !== null && Number.isFinite(f) && f >= 70 && f <= 800
  ) as number[];
  const ratio = voiced.length / window.length;
  if (ratio < 0.98) {
    return { suspect: false, voicedRatio: ratio, framesAnalyzed: window.length };
  }
  const sorted = [...voiced].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const variance =
    voiced.reduce((sum, f) => {
      const d = 1200 * Math.log2(f / median);
      return sum + d * d;
    }, 0) / voiced.length;
  const jitter = Math.sqrt(variance);
  return {
    suspect: jitter < 25,
    voicedRatio: ratio,
    framesAnalyzed: window.length,
  };
}

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
