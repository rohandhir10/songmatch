import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  arrangeForLevel,
  focusBand,
  suggestLevel,
} from "../src/lib/levels.ts";
import { songs } from "../src/lib/songs.ts";

const perfect = songs.find((s) => s.id === "perfect")!; // 55-71, tess 59-67

describe("focusBand (leveled arrangements)", () => {
  it("narrows the zone on Easy", () => {
    const b = focusBand(perfect, "Easy");
    assert.ok(b.lowMidi > perfect.tessituraLowMidi, "floor should rise");
    assert.ok(b.highMidi < perfect.tessituraHighMidi, "ceiling should drop");
    assert.ok(b.lowMidi < b.highMidi, "zone must stay valid");
  });

  it("uses full tessitura on Standard", () => {
    const b = focusBand(perfect, "Standard");
    assert.equal(b.lowMidi, perfect.tessituraLowMidi);
    assert.equal(b.highMidi, perfect.tessituraHighMidi);
  });

  it("opens to the full vocal range on Hard", () => {
    const b = focusBand(perfect, "Hard");
    assert.equal(b.lowMidi, perfect.vocalLowMidi);
    assert.equal(b.highMidi, perfect.vocalHighMidi);
  });
});

describe("arrangeForLevel", () => {
  it("keeps everything except the tessitura", () => {
    const a = arrangeForLevel(perfect, "Easy");
    assert.equal(a.id, perfect.id);
    assert.equal(a.title, perfect.title);
    assert.equal(a.vocalLowMidi, perfect.vocalLowMidi);
    assert.equal(a.vocalHighMidi, perfect.vocalHighMidi);
    assert.ok(a.tessituraLowMidi > perfect.tessituraLowMidi);
  });
});

describe("suggestLevel", () => {
  it("grades by fit headroom", () => {
    assert.equal(suggestLevel(95), "Hard");
    assert.equal(suggestLevel(70), "Standard");
    assert.equal(suggestLevel(30), "Easy");
  });
});
