import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  canSingSong,
  canTrainExercise,
  FREE_SONG_COUNT,
  paywallCopy,
} from "../src/lib/paywall.ts";

describe("paywall gating", () => {
  it("free users sing the first 8 songs only", () => {
    assert.equal(FREE_SONG_COUNT, 8);
    assert.equal(canSingSong(false, 0), true);
    assert.equal(canSingSong(false, 7), true);
    assert.equal(canSingSong(false, 8), false);
    assert.equal(canSingSong(false, 99), false);
  });

  it("pro users sing everything", () => {
    assert.equal(canSingSong(true, 99), true);
  });

  it("only the siren glide is free to train", () => {
    assert.equal(canTrainExercise(false, "siren-glide"), true);
    assert.equal(canTrainExercise(false, "major-scale-c"), false);
    assert.equal(canTrainExercise(true, "major-scale-c"), true);
  });

  it("paywall copy names the deal", () => {
    assert.ok(paywallCopy("songs").title.includes("100"));
    assert.ok(paywallCopy("training").title.length > 5);
  });
});
