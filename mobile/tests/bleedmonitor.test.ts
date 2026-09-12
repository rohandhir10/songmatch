import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { monitorBleed } from "../src/lib/miccheck.ts";

// Human singing: vibrato, breath gaps, consonant dropouts.
const humanLike = (): Array<number | null> => {
  const out: Array<number | null> = [];
  for (let i = 0; i < 600; i++) {
    if (i % 47 < 4) {
      out.push(null); // breath / consonant gaps
      continue;
    }
    if (i % 131 < 2) {
      out.push(440); // occasional octave pop
      continue;
    }
    out.push(220 * (1 + 0.008 * Math.sin((2 * Math.PI * 5 * i) / 60)));
  }
  return out;
};

// Speaker bleed: the track, continuous, near-zero jitter, never breathes.
const bleedLike = (): Array<number | null> =>
  Array(600)
    .fill(0)
    .map((_, i) => 196 * (1 + 0.002 * Math.sin((2 * Math.PI * 2 * i) / 60)));

describe("monitorBleed (continuous bleed watch)", () => {
  it("stays quiet on human singing", () => {
    const r = monitorBleed(humanLike());
    assert.equal(r.suspect, false);
  });

  it("flags continuous machine-steady pitch", () => {
    const r = monitorBleed(bleedLike());
    assert.equal(r.suspect, true);
    assert.ok(r.voicedRatio > 0.97);
  });

  it("abstains on short windows", () => {
    assert.equal(monitorBleed(Array(100).fill(196)).suspect, false);
  });

  it("tolerates a held note with vibrato and a breath", () => {
    const frames: Array<number | null> = Array(600)
      .fill(0)
      .map((_, i) =>
        i % 150 < 12
          ? null
          : 330 * (1 + 0.01 * Math.sin((2 * Math.PI * 5.5 * i) / 60))
      );
    assert.equal(monitorBleed(frames).suspect, false);
  });
});
