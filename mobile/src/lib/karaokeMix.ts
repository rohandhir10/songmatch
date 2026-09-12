// Karaoke mix from the user's own stereo audio: lead vocals sit centered
// (identical in L/R) while accompaniment spreads wide, so (L−R)/2 cancels
// the centered voice and keeps the sides. Same physics as the extraction
// isolator, run in reverse. Quality depends on the mix — centered bass and
// kick go quiet too — but the voice drops 10dB+ on typical pop mixes while
// guitars, keys and hats survive. Output is mono, peak-normalized.
export function reduceVocals(
  left: Float32Array,
  right: Float32Array
): Float32Array {
  const n = Math.min(left.length, right.length);
  const out = new Float32Array(n);
  let peak = 0;
  for (let i = 0; i < n; i++) {
    const v = (left[i] - right[i]) / 2;
    out[i] = v;
    const a = Math.abs(v);
    if (a > peak) peak = a;
  }
  if (peak > 0.89) {
    const gain = 0.89 / peak;
    for (let i = 0; i < n; i++) out[i] *= gain;
  }
  return out;
}
