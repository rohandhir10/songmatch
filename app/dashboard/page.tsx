"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  bestBySong,
  dayStreak,
  HISTORY_KEY,
  type PerformanceEntry,
} from "@/lib/history";
import type { VocalProfile } from "@/lib/pitch";

export default function DashboardPage() {
  const [profile, setProfile] = useState<VocalProfile | null>(null);
  const [history, setHistory] = useState<PerformanceEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const rawProfile = localStorage.getItem("songmatch-profile");
      if (rawProfile) setProfile(JSON.parse(rawProfile));
      const rawHistory = localStorage.getItem(HISTORY_KEY);
      if (rawHistory) {
        const parsed = JSON.parse(rawHistory);
        if (Array.isArray(parsed)) setHistory(parsed);
      }
    } catch {
      // Corrupt store: fall through to the empty state, user rescans.
    } finally {
      setLoaded(true);
    }
  }, []);

  const bests = useMemo(() => [...bestBySong(history).values()], [history]);
  const sessions = history.length;
  const average =
    sessions === 0
      ? null
      : Math.round(
          history.reduce((sum, e) => sum + e.accuracy, 0) / sessions
        );
  const streak = useMemo(() => dayStreak(history), [history]);
  const weakest =
    bests.length === 0
      ? null
      : bests.reduce((a, b) => (a.accuracy <= b.accuracy ? a : b));
  const recent = history.slice(0, 8);

  function songHref(songId: string): string {
    if (songId.startsWith("file:")) return "/singalong";
    if (songId.startsWith("yt:")) return "/popular";
    if (songId.startsWith("train:")) return "/train";
    return `/karaoke/${songId}`;
  }

  if (!loaded) {
    return (
      <main className="min-h-screen bg-[#070708] text-white">
        <div className="mx-auto max-w-4xl px-6 py-10" />
      </main>
    );
  }

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
            <h1 className="text-4xl font-black text-balance">
              Your progress lives here.
            </h1>
            <p className="mt-4 text-[#b8b8c0]">
              Scan your voice first — then every performance builds your
              history, streaks and best grades.
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
          <div className="flex items-center gap-5">
            <Link
              href="/scan"
              className="rounded-full border border-white/10 px-4 py-2 text-sm text-[#b8b8c0] hover:text-white"
            >
              Rescan
            </Link>
          </div>
        </header>

        <section className="pt-24">
          <h1 className="text-5xl font-black tracking-[-0.07em] text-balance">
            Your progress.
          </h1>
          <p className="mt-5 max-w-2xl text-[#b8b8c0]">
            Singing as a{" "}
            <span className="font-bold text-white">{profile.voiceType}</span>{" "}
            · {profile.lowNote}–{profile.highNote} ·{" "}
            <Link href="/matches" className="font-bold text-[#c8ff3d] hover:underline">
              My matches
            </Link>
          </p>

          <div className="mt-12 grid gap-3 sm:grid-cols-3">
            <Stat
              value={sessions === 0 ? "—" : String(sessions)}
              label={sessions === 1 ? "SESSION" : "SESSIONS"}
            />
            <Stat
              value={average === null ? "—" : `${average}%`}
              label="AVERAGE ACCURACY"
            />
            <Stat
              value={streak === 0 ? "—" : String(streak)}
              label="DAY STREAK"
            />
          </div>

          {weakest && (
            <Link
              href={songHref(weakest.songId)}
              className="mt-6 block rounded-3xl border border-[#c8ff3d]/25 bg-[#c8ff3d]/[0.05] p-6 transition hover:-translate-y-1"
            >
              <div className="text-xs font-bold text-[#8a8a94]">
                KEEP WORKING ON
              </div>
              <div className="mt-1 text-xl font-black">
                {weakest.songTitle}{" "}
                <span className="text-[#c8ff3d]">→</span>
              </div>
              <div className="mt-1 text-sm text-[#b8b8c0]">
                Best so far {weakest.accuracy}% · grade {weakest.grade}
              </div>
            </Link>
          )}

          {bests.length > 0 && (
            <div className="mt-12">
              <h2 className="text-2xl font-black tracking-tight">
                Best per song
              </h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {bests.map((b) => (
                  <div
                    key={b.songId}
                    className="flex items-center gap-4 rounded-3xl border border-white/10 bg-white/[0.03] p-5"
                  >
                    <GradeChip grade={b.grade} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-black">{b.songTitle}</div>
                      <div className="mt-0.5 text-xs text-[#8a8a94] tabular-nums">
                        {b.accuracy}% ·{" "}
                        {new Date(b.at).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </div>
                    </div>
                    <Link
                      href={songHref(b.songId)}
                      className="shrink-0 rounded-xl bg-[#c8ff3d] px-4 py-2.5 text-sm font-black text-black"
                    >
                      Sing →
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          {recent.length > 0 && (
            <div className="mt-12 pb-16">
              <h2 className="text-2xl font-black tracking-tight">
                Recent sessions
              </h2>
              <ol className="mt-4 divide-y divide-white/10 rounded-3xl border border-white/10 bg-white/[0.03] px-6">
                {recent.map((e, i) => (
                  <li
                    key={`${e.at}-${i}`}
                    className="flex items-center gap-4 py-4"
                  >
                    <span className="w-10 shrink-0 text-center text-lg font-black text-[#c8ff3d]">
                      {e.grade}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-bold">
                      {e.songTitle}
                    </span>
                    <span className="shrink-0 text-sm text-[#8a8a94] tabular-nums">
                      {e.accuracy}%
                    </span>
                    {e.level && (
                      <span className="shrink-0 rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-bold text-[#b8b8c0]">
                        {e.level}
                      </span>
                    )}
                    <span className="hidden w-24 shrink-0 text-right text-xs text-[#8a8a94] sm:block">
                      {new Date(e.at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {sessions === 0 && (
            <div className="mt-12 rounded-3xl border border-white/10 bg-white/[0.03] p-10 text-center">
              <p className="mx-auto max-w-md leading-7 text-[#b8b8c0]">
                No performances yet. Pick a match and sing it — your
                grades, streaks and bests will build up here.
              </p>
              <Link
                href="/matches"
                className="mt-6 inline-block rounded-2xl bg-[#c8ff3d] px-8 py-4 font-black text-black"
              >
                Find a song to sing →
              </Link>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-center">
      <div className="text-4xl font-black tabular-nums">{value}</div>
      <div className="mt-2 text-[10px] font-bold tracking-[0.12em] text-[#8a8a94]">
        {label}
      </div>
    </div>
  );
}

function GradeChip({ grade }: { grade: string }) {
  const hot = grade === "S" || grade === "A";
  return (
    <span
      className={
        hot
          ? "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#c8ff3d] text-xl font-black text-black"
          : "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-xl font-black text-white"
      }
    >
      {grade}
    </span>
  );
}
