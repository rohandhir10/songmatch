import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { scoreSongPerformance } from "../src/lib/matching.ts";
import { midiToFrequency } from "../src/lib/pitch.ts";
import { songs } from "../src/lib/songs.ts";

const perfect = songs.find((s) => s.id === "perfect")!;

// A song moves through registers: verse low and soft, chorus high belts.
// Scoring against one static band punishes singing the song correctly.
// scoreSongPerformance blends range-hold (comfort info) with steadiness
// (control, register-agnostic): a steady belt outside the band still scores.
describe("scoreSongPerformance (register-aware song scoring)", () => {
  it("rewards steady singing inside the tessitura", () => {
    const mid =
      (perfect.tessituraLowMidi + perfect.tessituraHighMidi) / 2;
    const frames = Array(120)
      .fill(0)
      .map((_, i) => midiToFrequency(mid) * (1 + 0.004 * Math.sin(i / 3)));
    const r = scoreSongPerformance(frames, perfect);
    assert.ok(r);
    assert.ok(r!.accuracy >= 80, `got ${r!.accuracy}`);
  });

  it("still credits a steady belt above the tessitura", () => {
    const belt = midiToFrequency(perfect.tessituraHighMidi + 4);
    const frames = Array(120)
      .fill(0)
      .map((_, i) => belt * (1 + 0.004 * Math.sin(i / 3)));
    const r = scoreSongPerformance(frames, perfect);
    assert.ok(r);
    // Outside the band but controlled: must beat a failing grade.
    assert.ok(r!.accuracy >= 50, `belt scored ${r!.accuracy}`);
    assert.ok(r!.rangeHold < r!.steadiness, "range should lag control here");
  });

  it("punishes wild sliding even inside the range", () => {
    const lo = midiToFrequency(perfect.vocalLowMidi);
    const hi = midiToFrequency(perfect.vocalHighMidi);
    const frames = Array(120)
      .fill(0)
      .map((_, i) => lo + ((hi - lo) * i) / 120);
    const r = scoreSongPerformance(frames, perfect);
    assert.ok(r);
    assert.ok(r!.accuracy < 60, `slide scored ${r!.accuracy}`);
  });

  it("returns null for empty input", () => {
    assert.equal(scoreSongPerformance([], perfect), null);
  });
});
