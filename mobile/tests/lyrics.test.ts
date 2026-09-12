import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { pickSynced, searchUrl } from "../src/lib/lyrics.ts";

describe("pickSynced (lyrics fetch)", () => {
  it("prefers synced lyrics with matching duration", () => {
    const results = [
      { syncedLyrics: null, plainLyrics: "x", duration: 200 },
      { syncedLyrics: "[00:01.00]hi\n", duration: 999 },
      { syncedLyrics: "[00:01.00]hey\n", duration: 204 },
    ];
    const best = pickSynced(results, 204);
    assert.equal(best, "[00:01.00]hey\n");
  });

  it("returns null when nothing is synced", () => {
    assert.equal(
      pickSynced([{ syncedLyrics: null, duration: 1 }], 200),
      null
    );
  });

  it("builds a safe search URL", () => {
    const url = searchUrl("Imagine Dragons", "Believer");
    assert.ok(url.startsWith("https://lrclib.net/api/search"));
    assert.ok(url.includes("Believer"));
  });
});
