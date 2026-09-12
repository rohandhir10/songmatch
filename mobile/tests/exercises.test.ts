import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  exerciseDuration,
  exerciseToContour,
  exercises,
} from "../src/lib/exercises.ts";
import { scoreAgainstContour } from "../src/lib/contour.ts";

describe("exercise content", () => {
  it("ships at least 5 exercises with valid notes", () => {
    assert.ok(exercises.length >= 5);
    const ids = exercises.map((e) => e.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const e of exercises) {
      assert.ok(e.title && e.goal && e.howTo, e.id);
      assert.ok(e.bpm >= 40 && e.bpm <= 160, `${e.id} bpm`);
      assert.ok(e.notes.length >= 5, `${e.id} too short`);
      for (const n of e.notes) {
        assert.ok(n.midi >= 36 && n.midi <= 96, `${e.id} midi ${n.midi}`);
        assert.ok(n.beats > 0, `${e.id} zero-beat note`);
      }
    }
  });

  it("builds a timeline matching the exercise duration", () => {
    for (const e of exercises) {
      const c = exerciseToContour(e);
      const dur = exerciseDuration(e);
      const last = c.points[c.points.length - 1].t;
      assert.ok(
        Math.abs(last - dur) < 0.1,
        `${e.id}: timeline ${last} vs duration ${dur}`
      );
      assert.ok(
        c.points.every((p) => p.freq !== null),
        `${e.id}: guide has gaps`
      );
    }
  });

  it("scores a perfect singalong of the scale at ~0 cents", () => {
    const e = exercises.find((x) => x.id === "major-scale-c")!;
    const c = exerciseToContour(e);
    const live = c.points
      .filter((_, i) => i % 2 === 0)
      .map((p) => ({ t: p.t, freq: p.freq! }));
    const r = scoreAgainstContour(live, c);
    assert.ok(r);
    assert.ok(r!.meanAbsCents < 2, `got ${r!.meanAbsCents}`);
    assert.equal(r!.grade, "S");
  });
});
