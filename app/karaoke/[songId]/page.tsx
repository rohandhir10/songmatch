"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { songs } from "@/lib/songs";

export default function KaraokePage() {
  const params = useParams();

  const songId =
    typeof params.songId === "string"
      ? params.songId
      : "";

  const song = songs.find(
    (item) => item.id === songId
  );

  if (!song) {
    return (
      <main className="min-h-screen bg-[#070708] text-white">
        <div className="mx-auto max-w-4xl px-6 py-10">

          <Link
            href="/matches"
            className="text-[#c8ff3d]"
          >
            ← Back
          </Link>

          <h1 className="mt-12 text-4xl font-black">
            Song not found.
          </h1>

        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#070708] text-white">

      <div className="mx-auto max-w-5xl px-6 py-8">

        <header className="flex items-center justify-between">

          <Link
            href="/"
            className="text-2xl font-black tracking-[-0.06em]"
          >
            song<span className="text-[#c8ff3d]">match</span>
          </Link>

          <Link
            href="/matches"
            className="text-sm text-white/40 hover:text-white"
          >
            ← Matches
          </Link>

        </header>

        <section className="pt-20 text-center">

          <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#c8ff3d]">
            Karaoke
          </div>

          <h1 className="mt-4 text-5xl font-black tracking-[-0.07em]">
            {song.title}
          </h1>

          <p className="mt-3 text-white/40">
            {song.artist}
          </p>

          <div className="mx-auto mt-12 flex h-[380px] max-w-3xl flex-col items-center justify-center rounded-3xl border border-white/10 bg-white/[0.03]">

            <div className="text-xs font-bold uppercase tracking-[0.16em] text-white/30">
              Live pitch
            </div>

            <div className="mt-6 text-8xl font-black tracking-[-0.08em] text-[#c8ff3d]">
              C4
            </div>

            <p className="mt-4 text-sm text-white/30">
              Live pitch tracking will appear here.
            </p>

          </div>

          <div className="mx-auto mt-6 max-w-3xl">

            <div className="flex justify-between text-xs text-white/25">
              <span>0:00</span>
              <span>Preview mode</span>
              <span>3:45</span>
            </div>

            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-[0%] rounded-full bg-[#c8ff3d]" />
            </div>

          </div>

          <button
            onClick={() =>
              alert(
                "Next: connect the microphone pitch engine to this screen, then add licensed backing tracks and lyrics."
              )
            }
            className="mt-8 rounded-2xl bg-[#c8ff3d] px-10 py-4 font-black text-black"
          >
            Start performance
          </button>

        </section>

      </div>

    </main>
  );
}
