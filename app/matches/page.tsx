"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { songs } from "@/lib/songs";
import { matchSongs, type SongMatch } from "@/lib/matching";
import { midiToNote, type VocalProfile } from "@/lib/pitch";

export default function MatchesPage() {
  const [profile, setProfile] =
    useState<VocalProfile | null>(null);

  const [matches, setMatches] =
    useState<SongMatch[]>([]);

  useEffect(() => {
    const stored =
      localStorage.getItem(
        "songmatch-profile"
      );

    if (!stored) {
      return;
    }

    try {
      const parsed =
        JSON.parse(stored) as VocalProfile;

      setProfile(parsed);

      setMatches(
        matchSongs(
          parsed,
          songs
        )
      );
    } catch {
      localStorage.removeItem(
        "songmatch-profile"
      );
    }
  }, []);

  if (!profile) {
    return (
      <main className="min-h-screen bg-[#070708] text-white">
        <div className="mx-auto max-w-4xl px-6 py-10">

          <Link
            href="/"
            className="text-2xl font-black tracking-[-0.06em]"
          >
            song<span className="text-[#c8ff3d]">match</span>
          </Link>

          <div className="pt-32 text-center">

            <h1 className="text-4xl font-black">
              We need your voice first.
            </h1>

            <p className="mt-4 text-[#b8b8c0]">
              Scan your voice before we can recommend songs.
            </p>

            <Link
              href="/scan"
              className="mt-8 inline-block rounded-2xl bg-[#c8ff3d] px-7 py-4 font-black text-black"
            >
              Scan my voice →
            </Link>

          </div>

        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#070708] text-white">

      <div className="mx-auto max-w-6xl px-6 py-8">

        <header className="flex items-center justify-between">

          <Link
            href="/"
            className="text-2xl font-black tracking-[-0.06em]"
          >
            song<span className="text-[#c8ff3d]">match</span>
          </Link>

          <Link
            href="/scan"
            className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/50 hover:text-white"
          >
            Rescan
          </Link>

        </header>

        <section className="pt-24">

          <h1 className="text-5xl font-black tracking-[-0.07em] text-balance">
            Songs made for your voice.
          </h1>

          <p className="mt-5 max-w-2xl text-[#b8b8c0]">
            You were detected as a{" "}
            <span className="font-bold text-white">
              {profile.voiceType}
            </span>{" "}
            with an estimated usable range of{" "}
            <span className="font-bold text-white">
              {profile.lowNote}–{profile.highNote}
            </span>
            .
          </p>

          <div className="mt-12 grid gap-4 md:grid-cols-2">

            {matches.map((match) => (
              <article
                key={match.song.id}
                className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 transition hover:-translate-y-1 hover:bg-white/[0.05]"
              >

                <div className="flex items-start justify-between gap-6">

                  <div>
                    <h2 className="text-xl font-black">
                      {match.song.title}
                    </h2>

                    <p className="mt-1 text-sm text-[#b8b8c0]">
                      {match.song.artist}
                    </p>
                  </div>

                  <div className="text-2xl font-black text-[#c8ff3d]">
                    {match.score}%
                  </div>

                </div>

                <div className="mt-5 space-y-2.5">
                  <FitBar label="Range fit" value={match.rangeScore} />
                  <FitBar label="Comfort fit" value={match.tessituraScore} />
                </div>

                <p className="mt-4 text-xs text-[#8a8a94]">
                  Key {match.song.key} · {match.song.difficulty} ·{" "}
                  {midiToNote(match.song.vocalLowMidi)}–
                  {midiToNote(match.song.vocalHighMidi)}
                  {match.recommendedTranspose !== 0 && (
                    <>
                      {" "}· Shift{" "}
                      {match.recommendedTranspose > 0 ? "+" : ""}
                      {match.recommendedTranspose} semitones
                    </>
                  )}
                </p>

                <p className="mt-3 text-sm leading-6 text-[#b8b8c0]">
                  {match.explanation}
                </p>

                <Link
                  href={`/karaoke/${match.song.id}`}
                  className="mt-6 block rounded-xl bg-[#c8ff3d] px-4 py-3 text-center text-sm font-black text-black"
                >
                  Sing this song →
                </Link>

              </article>
            ))}

          </div>

        </section>

      </div>

    </main>
  );
}

function FitBar({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-[#8a8a94]">{label}</span>
        <span className="font-bold text-white tabular-nums">{value}%</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-[#c8ff3d]"
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );
}
