// Voice weight: two singers can share a range and suit different songs.
// A deep voice and a light voice at the same pitch carry energy in
// different parts of the spectrum. The spectral centroid (the
// energy-weighted middle of the spectrum) captures that in one number
// we already hold every frame via the analyser node.

export function spectralCentroid(
  magnitudes: ArrayLike<number>
): number | null {
  let energy = 0;
  let weighted = 0;
  for (let i = 0; i < magnitudes.length; i++) {
    const m = magnitudes[i];
    energy += m;
    weighted += m * i;
  }
  if (energy <= 0) return null;
  return weighted / energy; // in bins — caller scales by Hz/bin
}

// Relative brightness 0..1 across the singer's own frames: darkest frame
// seen = 0, brightest = 1. Self-normalizing, so mics and rooms don't skew
// it — a phone mic and a studio mic agree on where YOU sit.
export function brightnessLabel(relative: number): string {
  if (relative < 0.33) return "Deep & dark";
  if (relative < 0.66) return "Warm";
  return "Light & bright";
}
