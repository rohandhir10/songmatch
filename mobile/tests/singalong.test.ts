import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { scoreAgainstContour } from "../src/lib/contour.ts";
import type { ReferenceContour } from "../src/lib/contour.ts";

const flat440 = (seconds: number, hop = 1 / 60): ReferenceContour => {
  const points = [];
  for (let t = 0; t < seconds; t += hop) points.push({ t, freq: 440 });
  return { points, hopSeconds: hop };
};

describe("scoreAgainstContour (true target-note scoring)", () => {
  it("scores ~0 cents for perfect tracking", () => {
    const ref = flat440(5);
    const live = Array(200)
      .fill(0)
      .map((_, i) => ({ t: 0.5 + i / 60, freq: 440 }));
    const r = scoreAgainstContour(live, ref);
    assert.ok(r);
    assert.ok(r!.meanAbsCents < 5, `got ${r!.meanAbsCents}`);
    assert.equal(r!.grade, "S");
  });

  it("penalizes consistent +40c sharpness", () => {
    const ref = flat440(5);
    const sharp = 440 * Math.pow(2, 40 / 1200);
    const live = Array(200)
      .fill(0)
      .map((_, i) => ({ t: 0.5 + i / 60, freq: sharp }));
    const r = scoreAgainstContour(live, ref);
    assert.ok(r);
    assert.ok(
      r!.meanAbsCents > 30 && r!.meanAbsCents < 50,
      `got ${r!.meanAbsCents}`
    );
  });

  it("ignores live frames where the reference is unvoiced", () => {
    const ref: ReferenceContour = {
      points: [
        { t: 0, freq: 440 },
        { t: 1, freq: null },
        { t: 2, freq: 440 },
      ],
      hopSeconds: 1,
    };
    const live = [
      { t: 0, freq: 440 },
      { t: 1, freq: 880 }, // reference silent here: must not count
      { t: 2, freq: 440 },
    ];
    const r = scoreAgainstContour(live, ref);
    assert.ok(r);
    assert.equal(r!.framesScored, 2);
    assert.ok(r!.meanAbsCents < 5);
  });

  it("returns null with no overlapping voiced frames", () => {
    const ref = flat440(2);
    assert.equal(scoreAgainstContour([], ref), null);
    assert.equal(
      scoreAgainstContour([{ t: 99, freq: 440 }], ref),
      null
    );
  });
});
