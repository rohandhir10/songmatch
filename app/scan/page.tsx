"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import {
  buildVocalProfile,
  detectPitch,
  type VocalProfile,
} from "@/lib/pitch";

export default function ScanPage() {
  const [recording, setRecording] = useState(false);
  const [profile, setProfile] =
    useState<VocalProfile | null>(null);

  const [note, setNote] = useState("—");
  const [frequency, setFrequency] =
    useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const audioContext =
    useRef<AudioContext | null>(null);

  const analyser =
    useRef<AnalyserNode | null>(null);

  const stream =
    useRef<MediaStream | null>(null);

  const animationFrame =
    useRef<number | null>(null);

  const samples =
    useRef<number[]>([]);

  const startedAt =
    useRef<number>(0);

  async function startScan() {
    try {
      const media =
        await navigator.mediaDevices.getUserMedia({
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
        throw new Error(
          "Web Audio is not supported in this browser."
        );
      }

      const context = new AudioContextClass();

      audioContext.current = context;

      const source =
        context.createMediaStreamSource(media);

      const node = context.createAnalyser();

      node.fftSize = 2048;

      source.connect(node);

      analyser.current = node;

      samples.current = [];
      startedAt.current = performance.now();

      setProfile(null);
      setNote("—");
      setFrequency(null);
      setElapsed(0);
      setRecording(true);

      detectLoop();
    } catch {
      alert(
        "Please allow microphone access to analyze your voice."
      );
    }
  }

  function detectLoop() {
    if (
      !analyser.current ||
      !audioContext.current
    ) {
      return;
    }

    const buffer =
      new Float32Array(
        analyser.current.fftSize
      );

    analyser.current.getFloatTimeDomainData(
      buffer
    );

    const detected =
      detectPitch(
        buffer,
        audioContext.current.sampleRate
      );

    if (detected >= 70 && detected <= 600) {
      samples.current.push(detected);

      setFrequency(detected);

      const midi =
        69 +
        12 *
          Math.log2(
            detected / 440
          );

      const noteNumber = Math.round(midi);

      const names = [
        "C",
        "C#",
        "D",
        "D#",
        "E",
        "F",
        "F#",
        "G",
        "G#",
        "A",
        "A#",
        "B",
      ];

      const name =
        names[
          ((noteNumber % 12) + 12) % 12
        ];

      const octave =
        Math.floor(noteNumber / 12) - 1;

      setNote(`${name}${octave}`);
    }

    setElapsed(
      (performance.now() -
        startedAt.current) /
        1000
    );

    animationFrame.current =
      requestAnimationFrame(
        detectLoop
      );
  }

  function stopScan() {
    if (animationFrame.current !== null) {
      cancelAnimationFrame(
        animationFrame.current
      );
    }

    stream.current
      ?.getTracks()
      .forEach((track) => track.stop());

    audioContext.current?.close();

    const result =
      buildVocalProfile(
        samples.current
      );

    if (!result) {
      setRecording(false);

      alert(
        "We couldn't detect enough usable pitch. Try speaking, humming or singing for a little longer."
      );

      return;
    }

    localStorage.setItem(
      "songmatch-profile",
      JSON.stringify(result)
    );

    setProfile(result);
    setRecording(false);
  }

  useEffect(() => {
    return () => {
      if (animationFrame.current !== null) {
        cancelAnimationFrame(
          animationFrame.current
        );
      }

      stream.current
        ?.getTracks()
        .forEach((track) => track.stop());

      audioContext.current?.close();
    };
  }, []);

  return (
    <main className="min-h-screen bg-[#070708] text-white">

      <div className="mx-auto max-w-4xl px-6 py-8">

        <header className="flex items-center justify-between">

          <Link
            href="/"
            className="text-2xl font-black tracking-[-0.06em]"
          >
            song<span className="text-[#c8ff3d]">match</span>
          </Link>

          <Link
            href="/"
            className="text-sm text-white/40 hover:text-white"
          >
            Home
          </Link>

        </header>

        <section className="mx-auto max-w-2xl pt-24">

          <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#c8ff3d]">
            Voice Analysis
          </div>

          <h1 className="mt-4 text-5xl font-black tracking-[-0.06em]">
            Let's find your range.
          </h1>

          <p className="mt-5 leading-7 text-white/40">
            Speak naturally, then hum or sing some comfortable notes.
            Don't force yourself to reach your highest or lowest note.
          </p>

          <div className="mt-10 rounded-3xl border border-white/10 bg-white/[0.03] p-7">

            {!recording && !profile && (
              <button
                onClick={startScan}
                className="w-full rounded-2xl bg-[#c8ff3d] px-6 py-5 text-lg font-black text-black transition hover:-translate-y-1"
              >
                Start voice scan →
              </button>
            )}

            {recording && (
              <div className="text-center">

                <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full border border-[#c8ff3d]/30 bg-[#c8ff3d]/10">
                  <span className="text-4xl">🎙️</span>
                </div>

                <div className="mt-7 text-xs font-bold uppercase tracking-[0.15em] text-[#c8ff3d]">
                  Listening
                </div>

                <div className="mt-4 text-7xl font-black tracking-[-0.08em]">
                  {note}
                </div>

                <div className="mt-2 text-sm text-white/40">
                  {frequency
                    ? `${frequency.toFixed(1)} Hz`
                    : "Waiting for pitch..."}
                </div>

                <div className="mt-3 text-xs text-white/25">
                  {elapsed.toFixed(1)} seconds
                </div>

                <button
                  onClick={stopScan}
                  className="mt-8 w-full rounded-2xl border border-white/10 bg-white/[0.05] px-6 py-4 font-bold hover:bg-white/[0.08]"
                >
                  Finish scan
                </button>

              </div>
            )}

            {profile && (
              <div>

                <div className="text-center">

                  <div className="text-xs font-bold uppercase tracking-[0.16em] text-[#c8ff3d]">
                    Your vocal profile
                  </div>

                  <div className="mt-4 text-6xl font-black tracking-[-0.08em]">
                    {profile.lowNote}
                    {" – "}
                    {profile.highNote}
                  </div>

                  <p className="mt-3 text-white/40">
                    Estimated usable vocal range
                  </p>

                </div>

                <div className="mt-8 grid gap-3 md:grid-cols-3">

                  <Stat
                    label="CENTER PITCH"
                    value={`${profile.centerFrequency.toFixed(
                      0
                    )} Hz`}
                  />

                  <Stat
                    label="VOICE PROFILE"
                    value={profile.voiceType}
                  />

                  <Stat
                    label="RANGE"
                    value={`${Math.round(
                      profile.maxMidi -
                        profile.minMidi
                    )} semitones`}
                  />

                </div>

                <div className="mt-6 rounded-2xl border border-[#c8ff3d]/20 bg-[#c8ff3d]/5 p-5 text-sm leading-6 text-white/60">
                  Your voice profile is ready. SongMatch can now compare it against the song catalogue and calculate which songs should fit you best.
                </div>

                <Link
                  href="/matches"
                  className="mt-5 block w-full rounded-2xl bg-[#c8ff3d] px-6 py-4 text-center font-black text-black transition hover:-translate-y-1"
                >
                  Find my songs →
                </Link>

              </div>
            )}

          </div>

        </section>

      </div>

    </main>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-center">

      <div className="text-lg font-black">
        {value}
      </div>

      <div className="mt-2 text-[10px] font-bold tracking-[0.12em] text-white/30">
        {label}
      </div>

    </div>
  );
}
