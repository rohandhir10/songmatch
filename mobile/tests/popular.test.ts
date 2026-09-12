import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { embedUrl, parseYouTubeId } from "../src/lib/youtube.ts";
import { popularSongs } from "../src/lib/popular.ts";

describe("youtube helpers", () => {
  it("parses watch, share, shorts and embed URLs plus raw ids", () => {
    assert.equal(
      parseYouTubeId("https://www.youtube.com/watch?v=hTWKbfoikeg"),
      "hTWKbfoikeg"
    );
    assert.equal(parseYouTubeId("https://youtu.be/hTWKbfoikeg"), "hTWKbfoikeg");
    assert.equal(
      parseYouTubeId("https://www.youtube.com/shorts/hTWKbfoikeg"),
      "hTWKbfoikeg"
    );
    assert.equal(
      parseYouTubeId(
        "https://www.youtube.com/embed/hTWKbfoikeg?si=xyz"
      ),
      "hTWKbfoikeg"
    );
    assert.equal(parseYouTubeId("hTWKbfoikeg"), "hTWKbfoikeg");
  });

  it("rejects garbage", () => {
    assert.equal(parseYouTubeId("not a link"), null);
    assert.equal(parseYouTubeId("https://example.com"), null);
    assert.equal(parseYouTubeId(""), null);
  });

  it("builds a privacy-enhanced embed URL", () => {
    assert.equal(
      embedUrl("hTWKbfoikeg"),
      "https://www.youtube-nocookie.com/embed/hTWKbfoikeg?rel=0&enablejsapi=1"
    );
  });
});

describe("popularSongs database", () => {
  it("holds exactly 100 songs with valid ranges", () => {
    assert.equal(popularSongs.length, 100);
    const exactIds = new Set([
      "perfect",
      "until-i-found-you",
      "all-of-me",
      "someone-you-loved",
      "tum-hi-ho",
      "as-it-was",
      "stay-with-me",
      "someone-like-you",
    ]);
    for (const s of popularSongs) {
      assert.ok(s.id && s.title && s.artist, s.id);
      assert.ok(
        s.vocalLowMidi < s.vocalHighMidi,
        `${s.id}: inverted range`
      );
      assert.ok(
        s.vocalLowMidi >= 36 && s.vocalHighMidi <= 96,
        `${s.id}: range outside singable bounds`
      );
      assert.ok(
        s.tessituraLowMidi >= s.vocalLowMidi &&
          s.tessituraHighMidi <= s.vocalHighMidi,
        `${s.id}: tessitura outside range`
      );
      assert.equal(
        s.rangeEstimate,
        !exactIds.has(s.id),
        `${s.id}: wrong estimate flag`
      );
    }
  });

  it("has unique ids", () => {
    const ids = popularSongs.map((s) => s.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it("covers every genre with at least 3 songs", () => {
    const genres = ["Pop", "Rock", "Soul", "Country", "Hindi", "Latin", "Classics", "Disney"];
    for (const g of genres) {
      const n = popularSongs.filter((s) => s.genre === g).length;
      assert.ok(n >= 3, `${g} has only ${n}`);
    }
  });
});
