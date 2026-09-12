import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { profileFromPcm } from "../src/lib/voiceAnalysis.ts";

function sineWave(freqHz: number, seconds: number, sampleRate = 44100) {
  const n = Math.floor(seconds * sampleRate);
  const buf = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    buf[i] = 0.5 * Math.sin((2 * Math.PI * freqHz * i) / sampleRate);
  }
  return buf;
}

describe("profileFromPcm (WAV-chunk path for native Scan)", () => {
  it("builds a profile from a clean 220Hz tone", () => {
    const pcm = sineWave(220, 1.5);
    const profile = profileFromPcm(pcm, 44100);
    assert.ok(profile, "expected profile from clean tone");
    // 220Hz ≈ A3 ≈ MIDI 57; allow ±3 semitones of detector wobble
    assert.ok(
      Math.abs(profile!.centerFrequency - 220) < 40,
      `center ${profile!.centerFrequency} too far from 220`
    );
  });

  it("returns null for silence", () => {
    const silent = new Float32Array(44100);
    assert.equal(profileFromPcm(silent, 44100), null);
  });
});
