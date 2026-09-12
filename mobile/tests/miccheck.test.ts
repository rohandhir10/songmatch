import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { analyzeSilence } from "../src/lib/miccheck.ts";

describe("analyzeSilence (speaker-bleed gate)", () => {
  it("flags bleed when pitch persists through silence", () => {
    const frames = Array(60)
      .fill(0)
      .map((_, i) => (i % 5 === 4 ? null : 220 + (i % 7)));
    const r = analyzeSilence(frames);
    assert.equal(r.bleed, true);
    assert.ok(r.voicedRatio > 0.4);
  });

  it("passes true silence with mic noise floor", () => {
    const frames = Array(60)
      .fill(0)
      .map((_, i) => (i % 20 === 0 ? 440 : null)); // rare blip
    const r = analyzeSilence(frames);
    assert.equal(r.bleed, false);
  });

  it("abstains on too few frames instead of guessing", () => {
    const r = analyzeSilence(Array(10).fill(220));
    assert.equal(r.bleed, false);
    assert.equal(r.framesAnalyzed, 10);
  });
});
