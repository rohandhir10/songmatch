import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  bestBySong,
  dayStreak,
  recordPerformance,
  type PerformanceEntry,
} from "../src/lib/history.ts";

const entry = (over: Partial<PerformanceEntry> = {}): PerformanceEntry => ({
  songId: "perfect",
  songTitle: "Perfect",
  accuracy: 82,
  grade: "A",
  framesInside: 82,
  framesTotal: 100,
  at: Date.now(),
  ...over,
});

const day = 24 * 60 * 60 * 1000;

describe("performance history (dashboard data)", () => {
  it("appends newest-first and caps length", () => {
    let h: PerformanceEntry[] = [];
    for (let i = 0; i < 105; i++) {
      h = recordPerformance(h, entry({ accuracy: i }));
    }
    assert.equal(h.length, 100);
    assert.equal(h[0].accuracy, 104);
  });

  it("keeps best grade per song", () => {
    const h = [
      entry({ songId: "a", accuracy: 60, grade: "B" }),
      entry({ songId: "a", accuracy: 92, grade: "S" }),
      entry({ songId: "b", accuracy: 70, grade: "B" }),
    ];
    const best = bestBySong(h);
    assert.equal(best.get("a")!.accuracy, 92);
    assert.equal(best.get("b")!.accuracy, 70);
  });

  it("counts day streak across consecutive days", () => {
    const now = Date.now();
    const h = [
      entry({ at: now }),
      entry({ at: now - day }),
      entry({ at: now - 2 * day }),
      entry({ at: now - 5 * day }),
    ];
    assert.equal(dayStreak(h), 3);
  });

  it("streak is 0 when last session is older than yesterday", () => {
    assert.equal(dayStreak([entry({ at: Date.now() - 3 * day })]), 0);
  });
});
