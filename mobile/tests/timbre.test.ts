import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  brightnessLabel,
  spectralCentroid,
} from "../src/lib/timbre.ts";

// Synth spectra: dark voice = energy in low bins, bright = high bins.
function spectrum(peaks: Array<[number, number]>, size = 512): Float32Array {
  const s = new Float32Array(size);
  for (const [bin, mag] of peaks) s[bin] = mag;
  return s;
}

describe("spectralCentroid (voice weight)", () => {
  it("sits low for dark voices, high for bright ones", () => {
    const dark = spectralCentroid(spectrum([[5, 1], [10, 0.6], [20, 0.2]]));
    const bright = spectralCentroid(
      spectrum([[5, 0.3], [40, 0.8], [120, 1]])
    );
    assert.ok(dark !== null && bright !== null);
    assert.ok(dark < bright, `${dark} should be < ${bright}`);
    assert.ok(dark < 15 && bright > 40);
  });

  it("returns null for silence", () => {
    assert.equal(spectralCentroid(new Float32Array(512)), null);
  });

  it("labels weight in plain words", () => {
    // centroid is in Hz once scaled — label on relative 0..1 instead.
    assert.equal(brightnessLabel(0.1), "Deep & dark");
    assert.equal(brightnessLabel(0.45), "Warm");
    assert.equal(brightnessLabel(0.8), "Light & bright");
  });
});
