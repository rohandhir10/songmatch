import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildVocalProfile,
  frequencyToMidi,
  midiToNote,
} from "../src/lib/pitch.ts";
import { matchSongs } from "../src/lib/matching.ts";
import { songs } from "../src/lib/songs.ts";

describe("shared vocal logic (mobile copy)", () => {
  it("440Hz maps to MIDI 69 (A4)", () => {
    assert.ok(Math.abs(frequencyToMidi(440) - 69) < 0.001);
    assert.equal(midiToNote(69), "A4");
  });

  it("builds a vocal profile from stable hum", () => {
    const freqs = Array(60)
      .fill(0)
      .map((_, i) => 130 + (i % 20)); // 130-149 Hz
    const profile = buildVocalProfile(freqs);
    assert.ok(profile, "expected a profile, got null");
    assert.ok(
      profile!.maxMidi > profile!.minMidi,
      "max should exceed min"
    );
    assert.ok(profile!.sampleCount >= 50);
  });

  it("rejects garbage input", () => {
    assert.equal(buildVocalProfile([]), null);
    assert.equal(buildVocalProfile([5, 9, 20000]), null);
  });

  it("ranks songs and returns explanations", () => {
    const freqs = Array(80)
      .fill(0)
      .map((_, i) => 140 + (i % 40));
    const profile = buildVocalProfile(freqs)!;
    const ranked = matchSongs(profile, songs);
    assert.equal(ranked.length, songs.length);
    assert.ok(
      ranked[0].score >= ranked[ranked.length - 1].score,
      "should be sorted desc"
    );
    assert.ok(ranked[0].explanation.length > 10);
  });
});
