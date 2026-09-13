import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  clampOffset,
  loadOffset,
  offsetKey,
  stepOffset,
  suggestOffset,
} from "../src/lib/lyricOffset.ts";

describe("lyricOffset", () => {
  it("clamps to ±10s and rejects NaN", () => {
    assert.equal(clampOffset(99), 10);
    assert.equal(clampOffset(-99), -10);
    assert.equal(clampOffset(NaN), 0);
    assert.equal(clampOffset(2.5), 2.5);
  });

  it("steps in half seconds without float drift", () => {
    assert.equal(stepOffset(0, 1), 0.5);
    assert.equal(stepOffset(0.5, 1), 1);
    assert.equal(stepOffset(0, -1), -0.5);
    assert.equal(stepOffset(10, 1), 10);
  });

  it("keys offsets per song, links fall back to video id", () => {
    assert.equal(offsetKey("hello", "abc"), "songmatch-offset:hello");
    assert.equal(offsetKey(null, "abc"), "songmatch-offset:link:abc");
  });

  it("loads saved offsets, defaults to 0", () => {
    const store = {
      get: new Map([["songmatch-offset:hello", "1.5"]]),
      getItem(k: string) {
        return this.get.get(k) ?? null;
      },
    };
    assert.equal(loadOffset(store, "hello", "abc"), 1.5);
    assert.equal(loadOffset(store, "other", "abc"), 0);
    assert.equal(
      loadOffset(
        {
          getItem() {
            throw new Error("denied");
          },
        },
        "hello",
        "abc"
      ),
      0
    );
  });

  it("suggests offset from voice onsets, needs 3 lines", () => {
    assert.equal(suggestOffset([]), null);
    assert.equal(
      suggestOffset([
        { expected: 10, actual: 11 },
        { expected: 20, actual: 21 },
      ]),
      null
    );
    // Singer lands ~1s after each tile: shift tiles later by 0.6.
    assert.equal(
      suggestOffset([
        { expected: 10, actual: 11 },
        { expected: 20, actual: 21.1 },
        { expected: 30, actual: 30.9 },
      ]),
      0.6
    );
    // Outlier onset doesn't drag the median.
    assert.equal(
      suggestOffset([
        { expected: 10, actual: 11 },
        { expected: 20, actual: 25 },
        { expected: 30, actual: 31 },
      ]),
      0.6
    );
  });
});
