import {
  buildVocalProfile,
  detectPitch,
  type VocalProfile,
} from "./pitch.ts";

// Why this exists: web Scan reads live Float32Array frames from
// AnalyserNode.getFloatTimeDomainData() at ~60fps. expo-av gives a recorded
// file, not live frames. This is the bridge: split decoded PCM into
// web-sized windows (2048) and reuse the proven autocorrelation detector
// per window, then build the same VocalProfile type matches/karaoke expect.
export function profileFromPcm(
  pcm: Float32Array,
  sampleRate: number,
  windowSize = 2048
): VocalProfile | null {
  if (!pcm.length || !Number.isFinite(sampleRate) || sampleRate <= 0) {
    return null;
  }
  const freqs: number[] = [];
  for (let offset = 0; offset + windowSize <= pcm.length; offset += windowSize) {
    const window = pcm.subarray(offset, offset + windowSize);
    const f = detectPitch(window, sampleRate);
    if (Number.isFinite(f) && f >= 70 && f <= 600) {
      freqs.push(f);
    }
  }
  if (freqs.length < 3) return null;
  return buildVocalProfile(freqs);
}
