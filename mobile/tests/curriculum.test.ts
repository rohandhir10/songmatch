import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  lessonStatus,
  planProgress,
  PLANS,
} from "../src/lib/curriculum.ts";
import type { PerformanceEntry } from "../src/lib/history.ts";

function entry(
  songId: string,
  accuracy: number,
  at: number
): PerformanceEntry {
  return {
    songId,
    songTitle: songId,
    accuracy,
    grade: "B",
    framesInside: 10,
    framesTotal: 10,
    at,
  };
}

describe("curriculum", () => {
  const plan = PLANS[0];
  const since = Date.now() - 30 * 24 * 3600 * 1000;

  it("marks lessons done at goal, open below it", () => {
    const history = [entry("train:siren-glide", 80, Date.now())];
    const done = lessonStatus(history, plan.lessons[0], since);
    assert.equal(done.done, true);
    const hard = lessonStatus(
      history,
      { ...plan.lessons[0], goal: 95 },
      since
    );
    assert.equal(hard.done, false);
    assert.equal(hard.best, 80);
  });

  it("ignores sessions from before the plan started", () => {
    const history = [
      entry("train:siren-glide", 99, since - 1000),
    ];
    assert.equal(lessonStatus(history, plan.lessons[0], since).done, false);
  });

  it("counts plan progress and completion", () => {
    const now = Date.now();
    const history = plan.lessons
      .filter((l) => l.kind === "exercise")
      .map((l) => entry(`train:${l.exerciseId}`, l.goal, now));
    const p = planProgress(plan, history, since);
    // song lessons (if any) stay open without yt: entries
    assert.ok(p.done + p.open === plan.lessons.length);
  });

  it("ships at least two plans with real drills", () => {
    assert.ok(PLANS.length >= 2);
    for (const p of PLANS) {
      assert.ok(p.lessons.length >= 5);
      assert.ok(p.lessons.every((l) => l.goal > 0 && l.goal <= 100));
    }
  });
});
