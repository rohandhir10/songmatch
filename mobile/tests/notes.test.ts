import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { contourToNotes, scoreNoteHits } from "../src/lib/notes.ts";

// Contour: 0.5s of A4 (440), 0.5s of C5 (523.25), 0.25s silence, 0.5s of A4.
function synthContour() {
  const pts: Array<{ t: number; hz: number }> = [];
  const push = (t0: number, t1: number, hz: number) => {
    for (let t = t0; t < t1; t += 0.02) pts.push({ t, hz });
  };
  push(0, 0.5, 440);
  push(0.5, 1.0, 523.25);
  push(1.25, 1.75, 440);
  return pts;
}

describe("contourToNotes (StarMaker note blocks)", () => {
  it("turns steady regions into one note each, silence splits them", () => {
    const notes = contourToNotes(synthContour());
    assert.equal(notes.length, 3);
    assert.equal(notes[0].midi, 69); // A4
    assert.equal(notes[1].midi, 72); // C5
    assert.equal(notes[2].midi, 69);
    assert.ok(Math.abs(notes[0].start - 0) < 0.05);
    assert.ok(Math.abs(notes[0].end - 0.5) < 0.08);
  });

  it("ignores blips shorter than a 16th note", () => {
    const pts = synthContour();
    pts.push({ t: 2.0, hz: 659.25 }, { t: 2.02, hz: 659.25 });
    const notes = contourToNotes(pts);
    assert.equal(notes.length, 3);
  });

  it("handles vibrato without splitting the note", () => {
    const pts: Array<{ t: number; hz: number }> = [];
    for (let t = 0; t < 0.8; t += 0.02) {
      pts.push({ t, hz: 440 * Math.pow(2, (30 * Math.sin(t * 30)) / 1200) });
    }
    const notes = contourToNotes(pts);
    assert.equal(notes.length, 1);
    assert.equal(notes[0].midi, 69);
  });
});

describe("scoreNoteHits", () => {
  it("marks a note hit when the voice matches, missed when silent", () => {
    const notes = contourToNotes(synthContour());
    // Sing the first two notes on pitch, skip the third.
    const sung = [
      { t: 0.1, hz: 442 },
      { t: 0.3, hz: 438 },
      { t: 0.6, hz: 525 },
      { t: 0.8, hz: 521 },
    ];
    const res = scoreNoteHits(notes, sung);
    assert.equal(res[0].hit, true);
    assert.equal(res[1].hit, true);
    assert.equal(res[2].hit, false);
  });
});
