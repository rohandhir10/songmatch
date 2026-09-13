"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import {
  buildVocalProfile,
  centsOffNearest,
  detectPitch,
  frameGate,
  midiToNote,
  pitchSteadiness,
  smoothFrequencies,
  type VocalProfile,
} from "@/lib/pitch";
import {
  brightnessLabel,
} from "@/lib/timbre";

export default function ScanPage() {
  const [recording, setRecording] = useState(false);
  const [profile, setProfile] =
    useState<VocalProfile | null>(null);

  const [note, setNote] = useState("—");
  const [frequency, setFrequency] =
    useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [cents, setCents] = useState<number | null>(null);
  const [steadiness, setSteadiness] = useState<number | null>(null);

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

  const centroids =
    useRef<number[]>([]);

  const freqBins =
    useRef<Float32Array>(new Float32Array(1024));

  // The singer's brightness, self-normalized: where their mean centroid
  // sits between their own darkest and brightest frames. Mics and rooms
  // shift absolute spectra; relative position survives them.
  function weightOf(values: number[]): string | undefined {
    if (values.length < 5) return undefined;
    const sorted = [...values].sort((a, b) => a - b);
    const lo = sorted[0];
    const hi = sorted[sorted.length - 1];
    if (!(hi > lo)) return undefined;
    const mean =
      values.reduce((sum, v) => sum + v, 0) / values.length;
    return brightnessLabel((mean - lo) / (hi - lo));
  }

  const recent =
    useRef<number[]>([]);

  const line =
    useRef<number[]>([]);

  const uiTick =
    useRef(frameGate(4));

  const canvas =
    useRef<HTMLCanvasElement | null>(null);

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
      centroids.current = [];
      recent.current = [];
      line.current = [];
      setCents(null);
      setSteadiness(null);
      startedAt.current = performance.now();

      setProfile(null);
      setError(null);
      setNote("—");
      setFrequency(null);
      setElapsed(0);
      setRecording(true);

      detectLoop();
    } catch {
      setError(
        "Microphone access was blocked. Allow mic permission in your browser, then try again."
      );
    }
  }

  function drawLine() {
    const el = canvas.current;
    if (!el) return;
    const ctx = el.getContext("2d");
    if (!ctx) return;

    const W = el.width;
    const H = el.height;
    const min = Math.log2(70);
    const max = Math.log2(600);
    const yOf = (f: number) =>
      H - 8 - ((Math.log2(f) - min) / (max - min)) * (H - 16);

    ctx.clearRect(0, 0, W, H);

    // Semitone grid, stronger line on each C
    for (let midi = 36; midi <= 84; midi++) {
      const f = 440 * Math.pow(2, (midi - 69) / 12);
      if (f < 70 || f > 600) continue;
      const y = yOf(f);
      const isC = midi % 12 === 0;
      ctx.strokeStyle = isC
        ? "rgba(255,255,255,0.16)"
        : "rgba(255,255,255,0.05)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
      if (isC) {
        ctx.fillStyle = "rgba(255,255,255,0.28)";
        ctx.font = "10px system-ui";
        ctx.fillText(midiToNote(midi), 4, y - 3);
      }
    }

    const pts = line.current;
    if (pts.length < 2) return;
    ctx.strokeStyle = "#c8ff3d";
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.beginPath();
    pts.forEach((f, i) => {
      const x = (i / 179) * W;
      const y = yOf(Math.max(70, Math.min(600, f)));
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  function detectLoop() {
    if (
      !analyser.current ||
      !audioContext.current
    ) {
      return;
    }
    const paint = uiTick.current();

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

      // Voice weight: spectral centroid of this frame in Hz. dB bins go
      // linear first — averaging decibels would underweight the highs.
      analyser.current.getFloatFrequencyData(freqBins.current);
      const hzPerBin =
        audioContext.current.sampleRate / analyser.current.fftSize;
      let energy = 0;
      let weighted = 0;
      for (let i = 0; i < freqBins.current.length; i++) {
        const db = freqBins.current[i];
        if (db <= -100) continue;
        const mag = Math.pow(10, db / 20);
        energy += mag;
        weighted += mag * i * hzPerBin;
      }
      if (energy > 0) {
        centroids.current.push(weighted / energy);
      }

      // Display the trailing median, not the raw frame — vibrato and
      // single-frame pops make the raw readout flicker and look wrong
      // even when detection itself is accurate.
      recent.current.push(detected);
      if (recent.current.length > 8) {
        recent.current.shift();
      }
      const smoothedList = smoothFrequencies(recent.current, 5);
      const smoothed = smoothedList[smoothedList.length - 1] ?? detected;

      // UI commits throttled to ~15Hz; detection, recording and canvas
      // stay per-frame underneath.
      if (paint) {
        setFrequency(smoothed);
        setNote(midiToNote(69 + 12 * Math.log2(smoothed / 440)));
        setCents(centsOffNearest(smoothed));
      }

      line.current.push(smoothed);
      if (line.current.length > 180) line.current.shift();
      drawLine();
    }

    if (paint) {
      setElapsed(
        (performance.now() -
          startedAt.current) /
          1000
      );
    }

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
        samples.current,
        weightOf(centroids.current)
      );

    if (!result) {
      setRecording(false);

      setError(
        "We couldn't catch enough usable pitch. Hum or sing a little longer, closer to the mic, then finish again."
      );

      return;
    }

    localStorage.setItem(
      "songmatch-profile",
      JSON.stringify(result)
    );

    setSteadiness(pitchSteadiness(samples.current));
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

        </header>

        <section className="mx-auto max-w-2xl pt-24">

          <h1 className="text-5xl font-black tracking-[-0.06em] text-balance">
            Let&apos;s find your range.
          </h1>

          <p className="mt-5 leading-7 text-[#b8b8c0]">
            Speak naturally, then hum or sing some comfortable notes.
            Don&apos;t force yourself to reach your highest or lowest note.
          </p>

          {error && (
            <p role="alert" className="mt-6 rounded-2xl border border-[#ff5c69]/30 bg-[#ff5c69]/10 p-4 text-sm leading-6 text-[#ffb3ba]">
              {error}
            </p>
          )}

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

                <div className="relative mx-auto flex h-28 w-28 items-center justify-center rounded-full border border-[#c8ff3d]/30 bg-[#c8ff3d]/10">
                  <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-[#c8ff3d]/10" />
                  <svg
                    width="40"
                    height="40"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#c8ff3d"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <rect x="9" y="2" width="6" height="12" rx="3" />
                    <path d="M5 10a7 7 0 0 0 14 0" />
                    <line x1="12" y1="17" x2="12" y2="22" />
                    <line x1="8" y1="22" x2="16" y2="22" />
                  </svg>
                </div>

                <div className="mt-7 text-sm font-black tracking-[0.2em] text-[#c8ff3d]">
                  LISTENING
                </div>

                <div className="mt-4 text-7xl font-black tracking-[-0.08em]">
                  {note}
                </div>

                <div className="mt-2 text-sm text-[#b8b8c0]">
                  {frequency
                    ? `${frequency.toFixed(1)} Hz`
                    : "Waiting for pitch..."}
                </div>

                {cents !== null && (
                  <div className="mx-auto mt-4 max-w-xs">
                    <div className="relative h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div className="absolute top-0 bottom-0 left-1/2 w-px bg-white/40" />
                      <div
                        className="absolute top-0 bottom-0 w-1.5 rounded-full"
                        style={{
                          left: `calc(${50 + Math.max(-50, Math.min(50, cents))}% - 3px)`,
                          backgroundColor:
                            Math.abs(cents) <= 10
                              ? "#c8ff3d"
                              : Math.abs(cents) <= 25
                                ? "#ffc53d"
                                : "#ff5c69",
                        }}
                      />
                    </div>
                    <div
                      className="mt-1.5 text-xs tabular-nums"
                      style={{
                        color:
                          Math.abs(cents) <= 10
                            ? "#c8ff3d"
                            : Math.abs(cents) <= 25
                              ? "#ffc53d"
                              : "#ff5c69",
                      }}
                    >
                      {cents === 0
                        ? "in tune"
                        : `${cents > 0 ? "+" : ""}${cents} cents ${cents > 0 ? "sharp" : "flat"}`}
                    </div>
                  </div>
                )}

                <div className="mt-3 text-xs text-white/25">
                  {elapsed.toFixed(1)} seconds · {samples.current.length} pitch frames
                </div>

                <canvas
                  ref={canvas}
                  width={600}
                  height={160}
                  className="mx-auto mt-4 h-40 w-full max-w-md rounded-2xl border border-white/10 bg-black/40"
                />

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

                  <div className="text-6xl font-black tracking-[-0.08em] text-balance">
                    {profile.lowNote}
                    {" – "}
                    {profile.highNote}
                  </div>

                  <p className="mt-3 text-[#b8b8c0]">
                    Your usable vocal range · {profile.voiceType}
                    {profile.weight ? ` · ${profile.weight}` : ""}
                  </p>
                  {profile.weight && (
                    <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-[#8a8a94]">
                      Same range, different instrument: a {profile.weight.toLowerCase()} voice
                      suits different songs than other {profile.voiceType.toLowerCase()} voices.
                      Matches below are still by range — weight guidance is coming.
                    </p>
                  )}

                </div>

                <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">

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

                  <Stat
                    label="PITCH STEADINESS"
                    value={
                      steadiness === null ? "—" : `${steadiness}%`
                    }
                  />

                </div>

                <div className="mt-6 rounded-2xl border border-[#c8ff3d]/20 bg-[#c8ff3d]/5 p-5 text-sm leading-6 text-white/60">
                  Your voice profile is ready. SongMatch can now compare it against the song catalogue and calculate which songs should fit you best.
                  <span className="mt-1 block text-white/40">
                    We heard about {Math.max(1, Math.round(profile.sampleCount / 60))} seconds of steady singing.
                  </span>
                </div>

                <Link
                  href="/matches"
                  className="mt-5 block w-full rounded-2xl bg-[#c8ff3d] px-6 py-4 text-center font-black text-black transition hover:-translate-y-1"
                >
                  Find my songs →
                </Link>

                <button
                  onClick={startScan}
                  className="mt-3 block w-full rounded-2xl border border-white/10 bg-white/[0.05] px-6 py-3 text-sm font-bold hover:bg-white/[0.08]"
                >
                  Scan again
                </button>

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
