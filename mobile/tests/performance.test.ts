import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { scorePerformance } from "../src/lib/matching.ts";
import { midiToFrequency } from "../src/lib/pitch.ts";
import { songs } from "../src/lib/songs.ts";

const perfect = songs.find((s) => s.id === "perfect")!;

describe("scorePerformance (karaoke perform mode)", () => {
  it("scores 100 when every frame sits inside the tessitura", () => {
    const mid =
      (perfect.tessituraLowMidi + perfect.tessituraHighMidi) / 2;
    const frames = Array(100).fill(midiToFrequency(mid));
    const r = scorePerformance(frames, perfect);
    assert.ok(r);
    assert.equal(r!.accuracy, 100);
    assert.equal(r!.grade, "S");
  });

  it("scores near 0 when every frame is far outside", () => {
    const frames = Array(100).fill(midiToFrequency(30)); // far below
    const r = scorePerformance(frames, perfect);
    assert.ok(r);
    assert.ok(r!.accuracy < 20, `got ${r!.accuracy}`);
  });

  it("gives partial credit inside the outer vocal range", () => {
    const edge = perfect.vocalLowMidi; // inside range, below tessitura
    const frames = Array(100).fill(midiToFrequency(edge));
    const r = scorePerformance(frames, perfect);
    assert.ok(r);
    assert.ok(r!.accuracy > 0 && r!.accuracy < 100, `got ${r!.accuracy}`);
  });

  it("returns null for empty input", () => {
    assert.equal(scorePerformance([], perfect), null);
  });
});
