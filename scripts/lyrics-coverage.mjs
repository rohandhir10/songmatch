// Lyrics coverage worker: audits every shelf song against lrclib and
// writes lib/lyricsCoverage.json ({ id: { synced, duration } }).
// Run: node scripts/lyrics-coverage.mjs [--write]
// Without --write it only reports. Reads song metadata with regex so it
// never needs to import TS. Be polite: 300ms between requests.

import { readFileSync, writeFileSync } from "fs";

const WRITE = process.argv.includes("--write");

function songList() {
  const out = new Map();
  const pop = readFileSync("lib/popular.ts", "utf8");
  for (const m of pop.matchAll(
    /estimate\("([^"]+)", "([^"]+)", "([^"]+)"/g
  )) {
    out.set(m[1], { title: m[2], artist: m[3] });
  }
  const cat = readFileSync("lib/songs.ts", "utf8");
  for (const m of cat.matchAll(
    /id: "([^"]+)",\s+title: "([^"]+)",\s+artist: "([^"]+)"/g
  )) {
    out.set(m[1], { title: m[2], artist: m[3] });
  }
  return [...out.entries()].map(([id, s]) => ({ id, ...s }));
}

async function check(song) {
  const url =
    `https://lrclib.net/api/get?artist_name=${encodeURIComponent(song.artist)}` +
    `&track_name=${encodeURIComponent(song.title)}`;
  try {
    const r = await fetch(url);
    if (r.ok) {
      const j = await r.json();
      if (typeof j.syncedLyrics === "string" && j.syncedLyrics.includes("[")) {
        return { synced: true, duration: j.duration ?? null };
      }
    }
  } catch {
    // fall through to search
  }
  try {
    const r = await fetch(
      `https://lrclib.net/api/search?q=${encodeURIComponent(`${song.artist} ${song.title}`)}`
    );
    if (!r.ok) return { synced: false, duration: null };
    const hits = await r.json();
    const hit = Array.isArray(hits)
      ? hits.find(
          (h) =>
            typeof h.syncedLyrics === "string" && h.syncedLyrics.includes("[")
        )
      : null;
    return hit
      ? { synced: true, duration: hit.duration ?? null }
      : { synced: false, duration: null };
  } catch {
    return { synced: false, duration: null };
  }
}

const songs = songList();
console.log(`${songs.length} songs to audit`);
const coverage = {};
let ok = 0;
for (const s of songs) {
  coverage[s.id] = await check(s);
  if (coverage[s.id].synced) ok++;
  await new Promise((r) => setTimeout(r, 300));
}
console.log(`${ok}/${songs.length} have synced lyrics`);
const missing = songs.filter((s) => !coverage[s.id].synced).map((s) => s.id);
if (missing.length > 0) console.log("missing:", missing.join(", "));
if (WRITE) {
  writeFileSync(
    "lib/lyricsCoverage.json",
    JSON.stringify(coverage, null, 2) + "\n"
  );
  console.log("wrote lib/lyricsCoverage.json");
}
