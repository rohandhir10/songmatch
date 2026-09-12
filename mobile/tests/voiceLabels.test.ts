import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildVocalProfile,
  midiToFrequency,
  smoothFrequencies,
} from "../src/lib/pitch.ts";

const hum = (midiCenter: number, n = 60) => {
  const f = midiToFrequency(midiCenter);
  return Array(n)
    .fill(0)
    .map((_, i) => f * (1 + 0.01 * Math.sin(i)));
};

describe("live display smoothing", () => {
  it("kills single-frame octave pops", () => {
    const frames = [220, 221, 440, 219, 220, 880, 221, 220, 219, 222];
    const out = smoothFrequencies(frames, 5);
    assert.ok(out.length > 0);
    for (const f of out) {
      assert.ok(
        f < 300,
        `smoothed value ${f} let an octave pop through`
      );
    }
  });

  it("returns empty for empty input", () => {
    assert.deepEqual(smoothFrequencies([], 5), []);
  });
});

describe("voice labels", () => {
  const cases: Array<[number, string]> = [
    [43, "Bass"], // G1/F#1 area
    [50, "Baritone"], // D2
    [55, "Tenor"], // G2
    [60, "Alto"], // C3
    [65, "Mezzo-Soprano"], // F3
    [72, "Soprano"], // C4
  ];
  for (const [center, label] of cases) {
    it(`centers on MIDI ${center} as ${label}`, () => {
      const p = buildVocalProfile(hum(center));
      assert.ok(p, "expected profile");
      assert.equal(p!.voiceType, label);
    });
  }
});
