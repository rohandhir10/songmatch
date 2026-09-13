import { describe, it } from "node:test";
import assert from "node:assert/strict";
import aubio from "aubiojs";
import { detectPitch } from "../src/lib/pitch.ts";

const SR = 44100;
const N = 2048;

// Continuous vocal stream: integrated phase (no frame-boundary
// discontinuities), glide 220→440Hz, vibrato, harmonics. Sliced into
// overlapping windows the way the mic loop feeds the engine.
const STREAM_LEN = SR * 3;
const stream = new Float32Array(STREAM_LEN);
{
  let phase = 0;
  for (let i = 0; i < STREAM_LEN; i++) {
    const t = i / SR;
    const f = 220 * Math.pow(2, t / 2);
    const vib = 1 + 0.006 * Math.sin(2 * Math.PI * 5.5 * t);
    phase += ((2 * Math.PI * f * vib) / SR);
    stream[i] =
      0.7 * Math.sin(phase) + 0.2 * Math.sin(2 * phase) + 0.1 * Math.sin(3 * phase);
  }
}
function truthAt(t: number): number {
  return 220 * Math.pow(2, t / 2);
}

describe("aubio parity (engine upgrade)", () => {
  it("yinfft tracks a vocal glide within 1.5% mean error, no octave jumps", async () => {
    const A = await aubio();
    const pitch = new A.Pitch("yinfft", N, 512, SR);
    let errSum = 0;
    let n = 0;
    let jumps = 0;
    let prev = 0;
    for (let k = 0; k < 20; k++) {
      const start = k * 512;
      const buf = stream.slice(start, start + N);
      const truth = truthAt((start + N / 2) / SR);
      const f = pitch.do(buf);
      assert.ok(f > 50 && f < 2000, `insane reading ${f}`);
      const err = Math.abs(f - truth) / truth;
      errSum += err;
      n++;
      if (prev > 0) {
        const ratio = f / prev;
        const expected = Math.pow(2, 0.1 / 2 / (0.1 + 0.046));
        if (ratio > 1.8 || ratio < 0.55) jumps++;
      }
      prev = f;
    }
    const mean = errSum / n;
    console.log(`    aubio mean error ${(mean * 100).toFixed(2)}%, jumps ${jumps}`);
    assert.ok(mean < 0.015, `mean error ${(mean * 100).toFixed(2)}%`);
    assert.equal(jumps, 0);
  });

  it("agrees with autocorrelation within a semitone on steady tones", async () => {
    const A = await aubio();
    const pitch = new A.Pitch("yinfft", N, 512, SR);
    const tone = (freq: number, phase: number, noisy: boolean) => {
      const buf = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        const ph = (2 * Math.PI * freq * i) / SR + phase;
        buf[i] =
          0.7 * Math.sin(ph) +
          0.2 * Math.sin(2 * ph) +
          (noisy ? 0.015 * (Math.random() * 2 - 1) : 0);
      }
      return buf;
    };
    for (const freq of [196, 293.66, 440, 523.25]) {
      // Fresh phase + breath noise every call, like a real stream —
      // never the same bit-identical buffer twice.
      pitch.do(tone(freq, 0, true));
      pitch.do(tone(freq, 1.7, true));
      const a = pitch.do(tone(freq, 3.1, true));
      const b = detectPitch(tone(freq, 3.1, false), SR);
      const cents = Math.abs(1200 * Math.log2(a / b));
      assert.ok(cents < 100, `${freq}Hz: aubio ${a} vs ours ${b}`);
    }
  });
});
