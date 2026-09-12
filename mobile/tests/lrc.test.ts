import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { activeLyric, parseLrc } from "../src/lib/lrc.ts";

const SAMPLE = `[ar:Artist]
[ti:Title]
[00:01.00]First line here
[00:05.50]Second line here
[00:05.50]Duplicate time wins last
[00:10.00]Third line
[00:15.00]
[bad line without time]
[01:00.00]Last line`;

describe("parseLrc", () => {
  it("parses timed lines, skips tags and junk", () => {
    const r = parseLrc(SAMPLE);
    assert.equal(r.title, "Title");
    assert.equal(r.artist, "Artist");
    assert.equal(r.lines.length, 5);
    assert.equal(r.lines[0].text, "First line here");
    assert.ok(Math.abs(r.lines[0].t - 1.0) < 0.01);
  });

  it("keeps duplicate timestamps in file order", () => {
    const r = parseLrc(SAMPLE);
    const at55 = r.lines.filter((l) => Math.abs(l.t - 5.5) < 0.01);
    assert.equal(at55.length, 2);
    assert.equal(at55[1].text, "Duplicate time wins last");
  });

  it("drops empty lyric lines", () => {
    const r = parseLrc(SAMPLE);
    assert.ok(r.lines.every((l) => l.text.length > 0));
  });

  it("handles minute:second and hour variants", () => {
    const r = parseLrc("[00:00.00]a\n[01:02.50]b\n[1:02:03.00]c");
    assert.equal(r.lines.length, 3);
    assert.ok(Math.abs(r.lines[1].t - 62.5) < 0.01);
    assert.ok(Math.abs(r.lines[2].t - 3723) < 0.01);
  });
});

describe("activeLyric", () => {
  const r = parseLrc(SAMPLE);

  it("returns nothing before the first line", () => {
    assert.equal(activeLyric(r, 0.5), null);
  });

  it("holds the current line until the next starts", () => {
    assert.equal(activeLyric(r, 1.0)?.text, "First line here");
    assert.equal(activeLyric(r, 5.4)?.text, "First line here");
  });

  it("moves to the newest line at duplicate times", () => {
    assert.equal(activeLyric(r, 5.5)?.text, "Duplicate time wins last");
  });

  it("also returns the upcoming line", () => {
    const a = activeLyric(r, 2.0);
    assert.equal(a?.next, "Second line here");
  });

  it("holds the last line to the end", () => {
    assert.equal(activeLyric(r, 999)?.text, "Last line");
    assert.equal(activeLyric(r, 999)?.next, null);
  });
});
