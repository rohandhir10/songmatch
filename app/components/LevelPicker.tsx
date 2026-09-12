"use client";

import type { Level } from "@/lib/levels";

const LEVELS: Level[] = ["Easy", "Standard", "Hard"];

export default function LevelPicker({
  level,
  onChange,
}: {
  level: Level;
  onChange: (level: Level) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Difficulty level"
      className="inline-flex rounded-full border border-white/10 bg-white/[0.04] p-1"
    >
      {LEVELS.map((l) => (
        <button
          key={l}
          onClick={() => onChange(l)}
          aria-pressed={level === l}
          className={
            level === l
              ? "rounded-full bg-[#c8ff3d] px-4 py-1.5 text-xs font-black text-black"
              : "rounded-full px-4 py-1.5 text-xs font-bold text-[#b8b8c0] hover:text-white"
          }
        >
          {l}
        </button>
      ))}
    </div>
  );
}
