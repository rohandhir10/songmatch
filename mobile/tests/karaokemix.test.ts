import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { reduceVocals } from "../src/lib/karaokeMix.ts";

const SR = 44100;

// Centered lead + wide accompaniment, like a real stereo mix.
function fakeMix(seconds = 2.0): { left: Float32Array; right: Float32Array; vocal: Float32Array } {
  const n = Math.floor(seconds * SR);
  const left = new Float32Array(n);
  const right = new Float32Array(n);
  const vocal = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    phase += (2 * Math.PI * 220 * (1 + 0.006 * Math.sin(2 * Math.PI * 5 * t))) / SR;
    vocal[i] = 0.5 * Math.sin(phase);
    left[i] = vocal[i] + 0.25 * Math.sin(2 * Math.PI * 110 * t + 1);
    right[i] = vocal[i] + 0.25 * Math.sin(2 * Math.PI * 165 * t + 2);
  }
  return { left, right, vocal };
}

function corr(a: Float32Array, b: Float32Array): number {
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < a.length; i++) {
    num += a[i] * b[i];
    da += a[i] * a[i];
    db += b[i] * b[i];
  }
  return num / Math.sqrt(da * db || 1);
}

describe("reduceVocals (karaoke mix from user audio)", () => {
  it("attenuates the centered vocal but keeps the sides", () => {
    const { left, right, vocal } = fakeMix();
    const out = reduceVocals(left, right);
    assert.equal(out.length, Math.min(left.length, right.length));
    // Vocal nearly uncorrelated with the backing afterwards...
    assert.ok(
      Math.abs(corr(out, vocal)) < 0.25,
      `vocal still present: ${corr(out, vocal)}`
    );
    // ...while the wide accompaniment survives.
    const acc = Float32Array.from(left, (_, i) => left[i] - right[i]);
    assert.ok(
      Math.abs(corr(out, acc)) > 0.9,
      `accompaniment damaged: ${corr(out, acc)}`
    );
  });

  it("handles mono-length mismatch by truncating", () => {
    const { left, right } = fakeMix(1.0);
    const out = reduceVocals(left.subarray(0, 1000), right);
    assert.equal(out.length, 1000);
  });
});
