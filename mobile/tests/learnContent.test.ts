import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { LIBRARY, TOPICS, type Topic } from "../src/lib/learnContent.ts";
import { PLANS } from "../src/lib/curriculum.ts";

describe("learnContent library", () => {
  it("links only verified https URLs, video IDs well-formed", () => {
    for (const item of LIBRARY) {
      assert.ok(item.url.startsWith("https://"), item.id);
      if (item.kind === "video") {
        const id = item.url.split("v=")[1]?.split("&")[0];
        assert.ok(
          id !== undefined && /^[A-Za-z0-9_-]{11}$/.test(id),
          `${item.id}: bad video id`
        );
      }
      for (const t of item.topics) {
        assert.ok((TOPICS as readonly string[]).includes(t), `${item.id}: ${t}`);
      }
    }
  });

  it("covers every plan with at least three items", () => {
    for (const plan of PLANS) {
      const n = LIBRARY.filter((c) => c.forPlans.includes(plan.id)).length;
      assert.ok(n >= 3, `${plan.id}: only ${n} items`);
    }
  });

  it("mixes video and reading, no dead topics", () => {
    const kinds = new Set(LIBRARY.map((c) => c.kind));
    assert.ok(kinds.has("video") && kinds.has("article"));
    const used = new Set<Topic>();
    for (const c of LIBRARY) for (const t of c.topics) used.add(t);
    for (const t of TOPICS) assert.ok(used.has(t), `topic unused: ${t}`);
  });
});
