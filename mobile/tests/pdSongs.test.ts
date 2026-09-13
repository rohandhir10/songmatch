import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PD_SONGS, pdToChart, type PDNote } from "../src/lib/pdSongs.ts";

describe("pdSongs (built-in public-domain content)", () => {
  it("ships at least three songs with lyrics on every note", () => {
    assert.ok(PD_SONGS.length >= 3);
    for (const s of PD_SONGS) {
      assert.ok(s.notes.length >= 12, `${s.id}: too short`);
      assert.ok(
        s.notes.every((n: PDNote) => n.lyric.length > 0),
        `${s.id}: lyric gaps`
      );
      assert.ok(s.bpm >= 60 && s.bpm <= 140, `${s.id}: tempo`);
    }
  });

  it("converts beats to a sorted chart in seconds", () => {
    for (const s of PD_SONGS) {
      const chart = pdToChart(s);
      assert.equal(chart.length, s.notes.length);
      for (let i = 1; i < chart.length; i++) {
        assert.ok(chart[i].start >= chart[i - 1].start - 0.001);
      }
      const totalBeats = Math.max(
        ...s.notes.map((n: PDNote) => n.beat + n.beats)
      );
      const last = chart[chart.length - 1];
      // Chart times include the count-in lead.
      assert.ok(
        Math.abs(last.end - (1.2 + (totalBeats * 60) / s.bpm)) < 0.01
      );
    }
  });

  it("keeps leaps singable (nothing over an octave)", () => {
    for (const s of PD_SONGS) {
      for (let i = 1; i < s.notes.length; i++) {
        const leap = Math.abs(s.notes[i].midi - s.notes[i - 1].midi);
        assert.ok(leap <= 12, `${s.id} note ${i}: leap ${leap}`);
      }
    }
  });
});
