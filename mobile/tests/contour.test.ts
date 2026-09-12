import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractContour } from "../src/lib/contour.ts";

// Simulated phone recording: centered lead vocal + quieter off-center
// accompaniment, exactly what center-isolation is built to separate.
function fakeMix(
  vocalHz: number,
  seconds: number,
  sampleRate = 44100
): { left: Float32Array; right: Float32Array } {
  const n = Math.floor(seconds * sampleRate);
  const left = new Float32Array(n);
  const right = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    const vib = 1 + 0.006 * Math.sin(2 * Math.PI * 5 * t);
    phase += (2 * Math.PI * vocalHz * vib) / sampleRate;
    const vocal = 0.5 * Math.sin(phase);
    // Accompaniment panned differently per channel (sides), vocal centered
    const accL = 0.22 * Math.sin(2 * Math.PI * 110 * t + 1);
    const accR = 0.22 * Math.sin(2 * Math.PI * 165 * t + 2);
    left[i] = vocal + accL;
    right[i] = vocal + accR;
  }
  return { left, right };
}

describe("extractContour (reference vocal from user audio)", () => {
  it("tracks a 220Hz centered vocal through accompaniment", () => {
    const { left, right } = fakeMix(220, 2.0);
    const c = extractContour(left, right, 44100);
    assert.ok(c.points.length > 40, `only ${c.points.length} points`);
    const voiced = c.points.filter((p) => p.freq !== null);
    assert.ok(voiced.length / c.points.length > 0.7, "too much dropout");
    const median = [...voiced.map((p) => p.freq!)].sort((a, b) => a - b)[
      Math.floor(voiced.length / 2)
    ];
    assert.ok(
      Math.abs(median - 220) / 220 < 0.05,
      `median ${median} too far from 220`
    );
  });

  it("marks silence as unvoiced, not garbage", () => {
    const n = 44100;
    const c = extractContour(new Float32Array(n), new Float32Array(n), 44100);
    assert.ok(c.points.length > 0);
    assert.ok(c.points.every((p) => p.freq === null));
  });
});
