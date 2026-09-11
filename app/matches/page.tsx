"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { songs } from "@/lib/songs";
import { matchSongs, type SongMatch } from "@/lib/matching";
import type { VocalProfile } from "@/lib/pitch";

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

            <p className="mt-4 text-white/40">
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

          <div className="text-xs font-bold uppercase tracking-[0.16em] text-[#c8ff3d]">
            Your matches
          </div>

          <h1 className="mt-4 text-5xl font-black tracking-[-0.07em]">
            Songs made for your voice.
          </h1>

          <p className="mt-5 max-w-2xl text-white/40">
            You were detected as a{" "}
            <span className="text-white">
              {profile.voiceType}
            </span>{" "}
            with an estimated usable range of{" "}
            <span className="text-white">
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

                    <p className="mt-1 text-sm text-white/40">
                      {match.song.artist}
                    </p>
                  </div>

                  <div className="text-2xl font-black text-[#c8ff3d]">
                    {match.score}%
                  </div>

                </div>

                <div className="mt-5 flex flex-wrap gap-2">

                  <Tag>
                    Key {match.song.key}
                  </Tag>

                  <Tag>
                    {match.song.difficulty}
                  </Tag>

                  <Tag>
                    Range {match.song.vocalLowMidi}–
                    {match.song.vocalHighMidi}
                  </Tag>

                  {match.recommendedTranspose !== 0 && (
                    <Tag>
                      {match.recommendedTranspose > 0
                        ? "+"
                        : ""}
                      {match.recommendedTranspose} semitones
                    </Tag>
                  )}

                </div>

                <p className="mt-5 text-sm leading-6 text-white/50">
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

function Tag({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <span className="rounded-full bg-white/[0.07] px-3 py-1.5 text-[11px] text-white/50">
      {children}
    </span>
  );
}
