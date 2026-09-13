import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  clampOffset,
  loadOffset,
  offsetKey,
  stepOffset,
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
});
