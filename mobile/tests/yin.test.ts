import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { YIN } from "pitchfinder";
import { detectPitch } from "../src/lib/pitch.ts";
import { detectEngine, engineReady, warmEngine } from "../src/lib/engine.ts";

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
    phase += (2 * Math.PI * f * vib) / SR;
    stream[i] =
      0.7 * Math.sin(phase) +
      0.2 * Math.sin(2 * phase) +
      0.1 * Math.sin(3 * phase);
  }
}
function truthAt(t: number): number {
  return 220 * Math.pow(2, t / 2);
}

describe("YIN engine (pitchfinder)", () => {
  it("tracks a vocal glide within 1.5% mean error, no octave jumps", () => {
    const detect = YIN({ sampleRate: SR });
    let errSum = 0;
    let n = 0;
    let jumps = 0;
    let prev = 0;
    for (let k = 0; k < 20; k++) {
      const start = k * 512;
      const buf = stream.slice(start, start + N);
      const truth = truthAt((start + N / 2) / SR);
      const f = detect(buf);
      assert.ok(
        typeof f === "number" && f > 50 && f < 2000,
        `insane reading ${f}`
      );
      errSum += Math.abs((f as number) - truth) / truth;
      n++;
      if (prev > 0) {
        const ratio = (f as number) / prev;
        if (ratio > 1.8 || ratio < 0.55) jumps++;
      }
      prev = f as number;
    }
    const mean = errSum / n;
    console.log(`    YIN mean error ${(mean * 100).toFixed(2)}%, jumps ${jumps}`);
    assert.ok(mean < 0.015, `mean error ${(mean * 100).toFixed(2)}%`);
    assert.equal(jumps, 0);
  });

  it("agrees with autocorrelation within a semitone on steady tones", () => {
    const detect = YIN({ sampleRate: SR });
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
      const a = detect(tone(freq, 3.1, true));
      const b = detectPitch(tone(freq, 3.1, false), SR);
      assert.ok(typeof a === "number" && a !== null);
      const cents = Math.abs(1200 * Math.log2((a as number) / b));
      assert.ok(cents < 100, `${freq}Hz: YIN ${a} vs ours ${b}`);
    }
  });

  it("detectEngine prefers YIN and stays in contract", () => {
    warmEngine(SR);
    assert.equal(engineReady(SR), true);
    const f = detectEngine(stream.slice(0, N), SR);
    assert.ok(Number.isFinite(f) && f > 50 && f < 2000);
    // Silence: pages gate on 70–1200Hz, so anything outside (or NaN)
    // reads as unvoiced downstream.
    const s = detectEngine(new Float32Array(N), SR);
    assert.ok(Number.isNaN(s) || s < 70 || s > 1200);
  });
});
