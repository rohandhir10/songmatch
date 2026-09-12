import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { frameGate } from "../src/lib/pitch.ts";

describe("frameGate (UI update throttle)", () => {
  it("fires on the first call then every Nth", () => {
    const gate = frameGate(4);
    const hits = Array(9).fill(0).map(() => gate());
    assert.deepEqual(hits, [true, false, false, false, true, false, false, false, true]);
  });

  it("treats N below 1 as every frame", () => {
    const gate = frameGate(0);
    assert.equal(gate(), true);
    assert.equal(gate(), true);
  });
});
