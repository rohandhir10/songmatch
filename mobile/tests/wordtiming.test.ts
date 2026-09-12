import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseLrc, wordTimings } from "../src/lib/lrc.ts";

describe("wordTimings (per-word hit visuals)", () => {
  const song = parseLrc("[00:10.00]hello brave world\n[00:14.00]next line\n");

  it("distributes words across the line by character weight", () => {
    const words = wordTimings(song.lines[0], song.lines[1].t);
    assert.equal(words.length, 3);
    assert.equal(words[0].word, "hello");
    assert.ok(Math.abs(words[0].t - 10.0) < 0.01);
    // "hello brave world" = 5+1+5+1+5 chars; brave starts after 6/17
    const expected = 10 + (6 / 17) * 4;
    assert.ok(Math.abs(words[1].t - expected) < 0.05);
    assert.ok(words[2].t < 14.0, "last word starts before line ends");
  });

  it("falls back to a 4s window on the final line", () => {
    const words = wordTimings(song.lines[1], null);
    assert.equal(words.length, 2);
    assert.ok(words[1].t < song.lines[1].t + 4.0);
  });

  it("returns one entry for single-word lines", () => {
    const one = parseLrc("[00:01.00]hey\n[00:05.00]x\n");
    const words = wordTimings(one.lines[0], 5.0);
    assert.equal(words.length, 1);
    assert.equal(words[0].word, "hey");
  });
});
