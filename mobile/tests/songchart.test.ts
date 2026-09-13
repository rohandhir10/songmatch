import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildChart,
  scoreVsChart,
  type ChartNote,
} from "../src/lib/songchart.ts";

function hum(): Array<{ t: number; hz: number }> {
  const pts: Array<{ t: number; hz: number }> = [];
  const push = (t0: number, t1: number, hz: number) => {
    for (let t = t0; t < t1; t += 0.02) pts.push({ t, hz });
  };
  push(0.2, 0.9, 392); // G4
  push(1.1, 1.9, 523.25); // C5
  return pts;
}

describe("buildChart (hum-to-tiles)", () => {
  it("turns a hummed pass into pitched tiles", () => {
    const notes = buildChart(hum());
    assert.equal(notes.length, 2);
    assert.equal(notes[0].midi, 67); // G4
    assert.equal(notes[1].midi, 72); // C5
    assert.ok(Math.abs(notes[0].start - 0.2) < 0.06);
  });

  it("drops silence and blips", () => {
    assert.deepEqual(buildChart([]), []);
    const pts = hum();
    pts.push({ t: 3.0, hz: 659.25 });
    assert.equal(buildChart(pts).length, 2);
  });
});

describe("scoreVsChart", () => {
  it("scores a performance against the chart", () => {
    const chart: ChartNote[] = [
      { start: 0.2, end: 0.9, midi: 67 },
      { start: 1.1, end: 1.9, midi: 72 },
    ];
    const sung = [
      { t: 0.3, hz: 393 },
      { t: 0.6, hz: 390 },
      { t: 1.3, hz: 620 }, // wrong note
      { t: 1.6, hz: 625 },
    ];
    const res = scoreVsChart(chart, sung);
    assert.equal(res[0].hit, true);
    assert.equal(res[1].hit, false);
    assert.equal(res[0].coverage > 0.9, true);
  });
});
