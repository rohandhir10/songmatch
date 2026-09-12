"use client";

import { parseLrc, type LrcSong } from "@/lib/lrc";

// Shared lyric-sheet loader: the user supplies words for audio they own
// (or public-domain lyrics). We never fetch or bundle copyrighted lyrics.
export default function LyricsField({
  lrc,
  onLoad,
  onError,
}: {
  lrc: LrcSong | null;
  onLoad: (song: LrcSong) => void;
  onError: (message: string) => void;
}) {
  return (
    <label className="mt-3 block w-full cursor-pointer rounded-2xl border border-dashed border-white/20 bg-white/[0.02] px-6 py-3.5 text-center text-sm font-bold text-[#b8b8c0] hover:border-[#c8ff3d]/50 hover:text-white">
      {lrc
        ? `Lyrics loaded (${lrc.lines.length} lines) — replace?`
        : "Add lyrics (.lrc, optional)"}
      <input
        type="file"
        accept=".lrc,.txt"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          try {
            onLoad(parseLrc(await f.text()));
          } catch {
            onError("Couldn't read that lyric file.");
          }
        }}
      />
    </label>
  );
}
