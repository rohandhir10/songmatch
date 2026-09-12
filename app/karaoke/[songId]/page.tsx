"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";

import { songs } from "@/lib/songs";
import { scorePerformance, type PerformanceScore } from "@/lib/matching";
import {
  HISTORY_KEY,
  recordPerformance,
  type PerformanceEntry,
} from "@/lib/history";
import {
  detectPitch,
  midiToNote,
  smoothFrequencies,
} from "@/lib/pitch";

export default function KaraokePage() {
  const params = useParams();

  const songId =
    typeof params.songId === "string"
      ? params.songId
      : "";

  const song = songs.find(
    (item) => item.id === songId
  );

  const [performing, setPerforming] = useState(false);
  const [note, setNote] = useState("—");
  const [error, setError] = useState<string | null>(null);
  const [score, setScore] = useState<PerformanceScore | null>(null);

  const audioContext = useRef<AudioContext | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const animationFrame = useRef<number | null>(null);
  const frames = useRef<number[]>([]);
  const recent = useRef<number[]>([]);
  const drone = useRef<OscillatorNode | null>(null);

  function stopDrone() {
    try {
      drone.current?.stop();
    } catch {
      // Already stopped.
    }
    drone.current?.disconnect();
    drone.current = null;
  }

  function cleanup() {
    if (animationFrame.current !== null) {
      cancelAnimationFrame(animationFrame.current);
      animationFrame.current = null;
    }
    stopDrone();
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    audioContext.current?.close();
    audioContext.current = null;
  }

  function detectLoop() {
    if (!analyser.current || !audioContext.current) return;

    const buffer = new Float32Array(analyser.current.fftSize);
    analyser.current.getFloatTimeDomainData(buffer);

    const detected = detectPitch(
      buffer,
      audioContext.current.sampleRate
    );

    if (detected >= 70 && detected <= 600) {
      frames.current.push(detected);
      recent.current.push(detected);
      if (recent.current.length > 8) recent.current.shift();
      const list = smoothFrequencies(recent.current, 5);
      const smoothed = list[list.length - 1] ?? detected;
      setNote(midiToNote(69 + 12 * Math.log2(smoothed / 440)));
    }

    animationFrame.current = requestAnimationFrame(detectLoop);
  }

  async function startPerformance() {
    if (!song) return;
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      stream.current = media;

      const AudioContextClass =
        window.AudioContext ||
        (
          window as typeof window & {
            webkitAudioContext?: typeof AudioContext;
          }
        ).webkitAudioContext;
      if (!AudioContextClass) {
        throw new Error("Web Audio is not supported in this browser.");
      }

      const context = new AudioContextClass();
      audioContext.current = context;
      const source = context.createMediaStreamSource(media);
      const node = context.createAnalyser();
      node.fftSize = 2048;
      source.connect(node);
      analyser.current = node;

      frames.current = [];
      recent.current = [];
      setScore(null);
      setError(null);
      setNote("—");
      setPerforming(true);

      // Soft reference drone on the floor of the comfort zone — an
      // a cappella anchor so the voice has something to tune against.
      const droneFreq = 440 * Math.pow(2, (song.tessituraLowMidi - 69) / 12);
      const droneOsc = context.createOscillator();
      droneOsc.type = "sine";
      droneOsc.frequency.value = droneFreq;
      const droneGain = context.createGain();
      droneGain.gain.value = 0.04;
      droneOsc.connect(droneGain);
      droneGain.connect(context.destination);
      droneOsc.start();
      drone.current = droneOsc;

      detectLoop();
    } catch {
      setError(
        "Microphone access was blocked. Allow mic permission, then try again."
      );
    }
  }

  function stopPerformance() {
    cleanup();
    setPerforming(false);
    if (!song) return;
    const result = scorePerformance(frames.current, song);
    if (!result) {
      setError(
        "We didn't catch your voice. Get closer to the mic and perform again."
      );
      return;
    }
    const entry: PerformanceEntry = {
      songId: song.id,
      songTitle: song.title,
      accuracy: result.accuracy,
      grade: result.grade,
      framesInside: result.framesInside,
      framesTotal: result.framesTotal,
      at: Date.now(),
    };
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      const existing: PerformanceEntry[] = raw ? JSON.parse(raw) : [];
      localStorage.setItem(
        HISTORY_KEY,
        JSON.stringify(recordPerformance(existing, entry))
      );
    } catch {
      // History is a nice-to-have; a full or broken store must never
      // block showing the score.
    }
    setScore(result);
  }

  useEffect(() => cleanup, []);

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

  const low = midiToNote(song.tessituraLowMidi);
  const high = midiToNote(song.tessituraHighMidi);

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
            Key {song.key} · {song.difficulty} · Hold {low}–{high}
          </p>

          {error && (
            <p role="alert" className="mx-auto mt-6 max-w-md rounded-2xl border border-[#ff5c69]/30 bg-[#ff5c69]/10 p-4 text-sm leading-6 text-[#ffb3ba]">
              {error}
            </p>
          )}

          {!performing && !score && (
            <div className="mx-auto mt-12 max-w-3xl rounded-3xl border border-white/10 bg-white/[0.03] p-10">
              <p className="mx-auto max-w-md leading-7 text-[#b8b8c0]">
                Sing {song.title} and we&apos;ll score how much of it you
                hold inside its comfort zone ({low}–{high}).
                No backing track yet — your voice is the instrument.
              </p>
              <button
                onClick={startPerformance}
                className="mt-8 rounded-2xl bg-[#c8ff3d] px-10 py-4 font-black text-black transition hover:-translate-y-1"
              >
                Start performance
              </button>
            </div>
          )}

          {performing && (
            <div className="mx-auto mt-12 max-w-3xl rounded-3xl border border-[#c8ff3d]/25 bg-[#c8ff3d]/[0.04] p-10">
              <div className="text-sm font-black tracking-[0.2em] text-[#c8ff3d]">
                PERFORMING
              </div>
              <div className="mt-4 text-8xl font-black tracking-[-0.08em] text-balance">
                {note}
              </div>
              <p className="mt-4 text-sm text-[#b8b8c0]">
                Hold {low}–{high} · soft drone playing your floor note
              </p>
              <button
                onClick={stopPerformance}
                className="mt-8 w-full rounded-2xl border border-white/10 bg-white/[0.05] px-6 py-4 font-bold hover:bg-white/[0.08]"
              >
                Finish performance
              </button>
            </div>
          )}

          {!performing && score && (
            <div className="mx-auto mt-12 max-w-3xl rounded-3xl border border-white/10 bg-white/[0.03] p-10">
              <div className="text-sm font-black tracking-[0.2em] text-[#c8ff3d]">
                GRADE {score.grade}
              </div>
              <div className="mt-4 text-8xl font-black tracking-[-0.08em] tabular-nums">
                {score.accuracy}
                <span className="text-4xl text-[#8a8a94]">%</span>
              </div>
              <p className="mt-4 text-sm text-[#b8b8c0]">
                {score.framesInside} of {score.framesTotal} frames inside{" "}
                {low}–{high}
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <button
                  onClick={startPerformance}
                  className="rounded-2xl bg-[#c8ff3d] px-8 py-4 font-black text-black transition hover:-translate-y-1"
                >
                  Sing it again
                </button>
                <Link
                  href="/dashboard"
                  className="rounded-2xl border border-[#c8ff3d]/25 bg-[#c8ff3d]/[0.05] px-8 py-4 font-bold hover:bg-[#c8ff3d]/[0.08]"
                >
                  View my progress
                </Link>
                <Link
                  href="/matches"
                  className="rounded-2xl border border-white/10 bg-white/[0.05] px-8 py-4 font-bold hover:bg-white/[0.08]"
                >
                  Try another song
                </Link>
              </div>
            </div>
          )}

        </section>

      </div>

    </main>
  );
}
