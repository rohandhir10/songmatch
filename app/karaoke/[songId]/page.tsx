"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { songs } from "@/lib/songs";
import { midiToNote } from "@/lib/pitch";

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
            ← Back to matches
          </Link>

          <h1 className="mt-12 text-4xl font-black text-balance">
            We couldn&apos;t find that song.
          </h1>

          <p className="mt-4 text-[#b8b8c0]">
            It may have been removed from the catalogue. Pick another match
            instead.
          </p>

          <Link
            href="/matches"
            className="mt-8 inline-block rounded-2xl bg-[#c8ff3d] px-7 py-4 font-black text-black"
          >
            View my matches →
          </Link>

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
            className="text-sm text-[#b8b8c0] hover:text-white"
          >
            ← Matches
          </Link>

        </header>

        <section className="mx-auto max-w-3xl pt-20 text-center">

          <h1 className="text-5xl font-black tracking-[-0.07em] text-balance">
            {song.title}
          </h1>

          <p className="mt-3 text-[#b8b8c0]">
            {song.artist}
          </p>

          <p className="mt-4 text-xs text-[#8a8a94]">
            Key {song.key} · {song.difficulty} ·{" "}
            {midiToNote(song.vocalLowMidi)}–
            {midiToNote(song.vocalHighMidi)}
          </p>

          <div className="mt-12 rounded-3xl border border-white/10 bg-white/[0.03] p-10">

            <div className="text-sm font-black tracking-[0.2em] text-[#c8ff3d]">
              REHEARSAL ROOM
            </div>

            <p className="mx-auto mt-4 max-w-md leading-7 text-[#b8b8c0]">
              Live pitch tracking, backing tracks and synced lyrics are
              being built for this room now. Your match data above is
              real — the stage just isn&apos;t wired up yet.
            </p>

            <Link
              href="/scan"
              className="mt-8 inline-block rounded-2xl border border-white/10 bg-white/[0.05] px-8 py-4 font-bold hover:bg-white/[0.08]"
            >
              Rescan my voice
            </Link>

          </div>

        </section>

      </div>

    </main>
  );
}
