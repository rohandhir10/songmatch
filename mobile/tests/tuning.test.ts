import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  centsOffNearest,
  midiToFrequency,
  pitchSteadiness,
} from "../src/lib/pitch.ts";

describe("cents deviation", () => {
  it("reads ~0c on exact A4", () => {
    assert.ok(Math.abs(centsOffNearest(440)) < 1);
  });

  it("reads ~+30c when sharp", () => {
    const f = 440 * Math.pow(2, 30 / 1200);
    assert.ok(Math.abs(centsOffNearest(f) - 30) < 2);
  });

  it("reads negative when flat", () => {
    const f = 440 * Math.pow(2, -30 / 1200);
    assert.ok(Math.abs(centsOffNearest(f) + 30) < 2);
  });
});

describe("pitch steadiness (phrase score input)", () => {
  it("scores high for a stable tone with light vibrato", () => {
    const frames = Array(120)
      .fill(0)
      .map((_, i) => 220 * (1 + 0.004 * Math.sin((2 * Math.PI * 5 * i) / 60)));
    const s = pitchSteadiness(frames);
    assert.ok(s !== null && s >= 85, `got ${s}`);
  });

  it("scores low for wild sliding", () => {
    const frames = Array(120)
      .fill(0)
      .map((_, i) => 180 + (i * 200) / 120);
    const s = pitchSteadiness(frames);
    assert.ok(s !== null && s < 40, `got ${s}`);
  });

  it("returns null for empty input", () => {
    assert.equal(pitchSteadiness([]), null);
  });
});
