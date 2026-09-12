"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import {
  exerciseDuration,
  exerciseToContour,
  exercises,
  type Exercise,
} from "@/lib/exercises";
import {
  scoreAgainstContour,
  type ContourScore,
  type LiveFrame,
} from "@/lib/contour";
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

type Phase = "pick" | "performing" | "scored";

const PAST = 2;
const AHEAD = 4;

export default function TrainPage() {
  const [phase, setPhase] = useState<Phase>("pick");
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("—");
  const [devCents, setDevCents] = useState<number | null>(null);
  const [score, setScore] = useState<ContourScore | null>(null);

  const playContext = useRef<AudioContext | null>(null);
  const guideNodes = useRef<OscillatorNode[]>([]);
  const startedAt = useRef(0);
  const duration = useMemo(
    () => (exercise ? exerciseDuration(exercise) : 0),
    [exercise]
  );
  const contour = useMemo(
    () => (exercise ? exerciseToContour(exercise) : null),
    [exercise]
  );

  const micContext = useRef<AudioContext | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const animationFrame = useRef<number | null>(null);
  const live = useRef<LiveFrame[]>([]);
  const recent = useRef<number[]>([]);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const contourRef = useRef(contour);
  contourRef.current = contour;

  function now(): number {
    if (!playContext.current) return 0;
    return Math.max(
      0,
      playContext.current.currentTime - startedAt.current
    );
  }

  function contourAt(t: number): number | null {
    const ref = contourRef.current;
    if (!ref) return null;
    const pts = ref.points;
    let lo = 0;
    let hi = pts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (pts[mid].t < t) lo = mid + 1;
      else hi = mid;
    }
    let best = lo;
    if (lo > 0 && Math.abs(pts[lo - 1].t - t) < Math.abs(pts[lo].t - t)) {
      best = lo - 1;
    }
    if (Math.abs(pts[best].t - t) > ref.hopSeconds * 2) return null;
    return pts[best].freq;
  }

  function draw(t: number) {
    const el = canvas.current;
    const ref = contourRef.current;
    if (!el || !ref) return;
    const ctx = el.getContext("2d");
    if (!ctx) return;

    const W = el.width;
    const H = el.height;
    const t0 = t - PAST;
    const t1 = t + AHEAD;
    const xOf = (tt: number) => ((tt - t0) / (t1 - t0)) * W;

    let lo = Infinity;
    let hi = -Infinity;
    for (const p of ref.points) {
      if (p.t < t0 || p.t > t1 || p.freq === null) continue;
      lo = Math.min(lo, p.freq);
      hi = Math.max(hi, p.freq);
    }
    if (!Number.isFinite(lo)) {
      lo = 110;
      hi = 440;
    }
    lo = Math.max(60, lo * 0.89);
    hi = Math.min(900, hi * 1.12);
    const lomin = Math.log2(lo);
    const lomax = Math.log2(hi);
    const yOf = (f: number) =>
      H - 10 - ((Math.log2(f) - lomin) / (lomax - lomin)) * (H - 20);

    ctx.clearRect(0, 0, W, H);

    for (let midi = 24; midi <= 96; midi++) {
      const f = 440 * Math.pow(2, (midi - 69) / 12);
      if (f < lo || f > hi) continue;
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
        ctx.fillStyle = "rgba(255,255,255,0.30)";
        ctx.font = "10px system-ui";
        ctx.fillText(midiToNote(midi), 4, y - 3);
      }
    }

    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(xOf(t), 0);
    ctx.lineTo(xOf(t), H);
    ctx.stroke();

    // Guide (lime)
    ctx.strokeStyle = "#c8ff3d";
    ctx.lineWidth = 2.5;
    ctx.lineJoin = "round";
    ctx.beginPath();
    let pen = false;
    for (const p of ref.points) {
      if (p.t < t0 || p.t > t1 || p.freq === null) {
        pen = false;
        continue;
      }
      const x = xOf(p.t);
      const y = yOf(p.freq);
      if (!pen) {
        ctx.moveTo(x, y);
        pen = true;
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // Voice overlay (white)
    const trail = live.current.filter((f) => f.t >= t0 && f.t <= t);
    if (trail.length > 1) {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      trail.forEach((f, i) => {
        const x = xOf(f.t);
        const y = yOf(Math.max(lo, Math.min(hi, f.freq)));
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }
  }

  function detectLoop() {
    if (!analyser.current || !micContext.current) return;
    const t = now();

    const buffer = new Float32Array(analyser.current.fftSize);
    analyser.current.getFloatTimeDomainData(buffer);
    const detected = detectPitch(buffer, micContext.current.sampleRate);

    if (detected >= 70 && detected <= 800) {
      recent.current.push(detected);
      if (recent.current.length > 8) recent.current.shift();
      const list = smoothFrequencies(recent.current, 5);
      const smoothed = list[list.length - 1] ?? detected;
      setNote(midiToNote(69 + 12 * Math.log2(smoothed / 440)));
      live.current.push({ t, freq: smoothed });
      const ref = contourAt(t);
      setDevCents(
        ref !== null && ref > 0
          ? Math.round(1200 * Math.log2(smoothed / ref))
          : null
      );
    } else {
      setDevCents(null);
    }

    draw(t);
    if (t < duration + 1) {
      animationFrame.current = requestAnimationFrame(detectLoop);
    } else {
      finish();
    }
  }

  function stopGuide() {
    guideNodes.current.forEach((o) => {
      try {
        o.stop();
      } catch {
        // Already stopped.
      }
      o.disconnect();
    });
    guideNodes.current = [];
  }

  function cleanupMic() {
    if (animationFrame.current !== null) {
      cancelAnimationFrame(animationFrame.current);
      animationFrame.current = null;
    }
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    micContext.current?.close();
    micContext.current = null;
  }

  async function beginExercise(ex: Exercise) {
    setError(null);
    setScore(null);
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: true,
          autoGainControl: false,
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
      const mic = new AudioContextClass();
      micContext.current = mic;
      const source = mic.createMediaStreamSource(media);
      const node = mic.createAnalyser();
      node.fftSize = 2048;
      source.connect(node);
      analyser.current = node;

      // Guide tones: one soft oscillator per note, gentle attack/release
      // so there are no clicks. This IS the backing track — synthesized,
      // owned, and exactly matching the scoring timeline.
      const play = new AudioContextClass();
      playContext.current = play;
      const beatSeconds = 60 / ex.bpm;
      const t0 = play.currentTime + 0.6;
      startedAt.current = t0;
      let cursor = t0;
      const gain = play.createGain();
      gain.gain.value = 0.16;
      gain.connect(play.destination);
      for (const n of ex.notes) {
        const freq = 440 * Math.pow(2, (n.midi - 69) / 12);
        const dur = n.beats * beatSeconds;
        const osc = play.createOscillator();
        osc.type = "sine";
        osc.frequency.value = freq;
        const g = play.createGain();
        g.gain.setValueAtTime(0, cursor);
        g.gain.linearRampToValueAtTime(1, cursor + 0.03);
        g.gain.setValueAtTime(1, cursor + Math.max(0.03, dur - 0.05));
        g.gain.linearRampToValueAtTime(0, cursor + dur);
        osc.connect(g);
        g.connect(gain);
        osc.start(cursor);
        osc.stop(cursor + dur + 0.02);
        guideNodes.current.push(osc);
        cursor += dur;
      }

      setExercise(ex);
      live.current = [];
      recent.current = [];
      setNote("—");
      setDevCents(null);
      setPhase("performing");
      detectLoop();
    } catch {
      cleanupMic();
      setError(
        "Microphone access was blocked. Allow mic permission, then try again."
      );
    }
  }

  function finish() {
    stopGuide();
    cleanupMic();
    const ref = contourRef.current;
    if (!ref) {
      setPhase("pick");
      return;
    }
    const result = scoreAgainstContour(live.current, ref);
    if (!result) {
      setError("We didn't catch your voice. Wear earbuds and try again.");
      setPhase("pick");
      return;
    }
    const ex = exercise;
    const entry: PerformanceEntry = {
      songId: ex ? `train:${ex.id}` : "train:unknown",
      songTitle: ex ? ex.title : "Exercise",
      accuracy: Math.max(0, Math.min(100, 100 - Math.round(result.meanAbsCents))),
      grade: result.grade,
      framesInside: result.framesScored,
      framesTotal: live.current.length,
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
      // History must never block the score.
    }
    setScore(result);
    setPhase("scored");
  }

  function quitToList() {
    stopGuide();
    cleanupMic();
    setPhase("pick");
  }

  useEffect(
    () => () => {
      stopGuide();
      cleanupMic();
      playContext.current?.close();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return (
    <main className="min-h-screen bg-[#070708] text-white">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <header className="flex items-center justify-between">
          <Link href="/" className="text-2xl font-black tracking-[-0.06em]">
            song<span className="text-[#c8ff3d]">match</span>
          </Link>
        </header>

        <section className="mx-auto max-w-3xl pt-20 text-center">
          <h1 className="text-5xl font-black tracking-[-0.07em] text-balance">
            Train your voice.
          </h1>
          <p className="mx-auto mt-5 max-w-xl leading-7 text-[#b8b8c0]">
            Guided exercises with a synthesized coach tone — hear the line,
            sing the line, get scored note-for-note. Wear earbuds.
          </p>

          {error && (
            <p
              role="alert"
              className="mx-auto mt-6 max-w-md rounded-2xl border border-[#ff5c69]/30 bg-[#ff5c69]/10 p-4 text-sm leading-6 text-[#ffb3ba]"
            >
              {error}
            </p>
          )}

          {phase === "pick" && (
            <div className="mt-10 grid gap-3 text-left md:grid-cols-2">
              {exercises.map((ex) => (
                <div
                  key={ex.id}
                  className="rounded-3xl border border-white/10 bg-white/[0.03] p-6"
                >
                  <div className="text-lg font-black">{ex.title}</div>
                  <div className="mt-1 text-sm text-[#b8b8c0]">{ex.goal}</div>
                  <p className="mt-3 text-xs leading-5 text-[#8a8a94]">
                    {ex.howTo}
                  </p>
                  <div className="mt-2 text-xs text-[#8a8a94] tabular-nums">
                    {ex.notes.length} notes · {Math.round(exerciseDuration(ex))}s
                    · {ex.bpm} BPM
                  </div>
                  <button
                    onClick={() => beginExercise(ex)}
                    className="mt-4 w-full rounded-xl bg-[#c8ff3d] px-4 py-3 text-sm font-black text-black transition hover:-translate-y-0.5"
                  >
                    Start →
                  </button>
                </div>
              ))}
            </div>
          )}

          {(phase === "performing" || phase === "scored") && exercise && (
            <div className="mt-10">
              <div className="text-xl font-black">{exercise.title}</div>
              <div className="mt-6 flex items-baseline justify-center gap-6">
                <div className="text-6xl font-black tracking-[-0.06em]">
                  {note}
                </div>
                {devCents !== null && phase === "performing" && (
                  <div
                    className="text-2xl font-black tabular-nums"
                    style={{
                      color:
                        Math.abs(devCents) <= 15
                          ? "#c8ff3d"
                          : Math.abs(devCents) <= 40
                            ? "#ffc53d"
                            : "#ff5c69",
                    }}
                  >
                    {devCents === 0
                      ? "±0¢"
                      : `${devCents > 0 ? "+" : ""}${devCents}¢`}
                  </div>
                )}
              </div>

              <canvas
                ref={canvas}
                width={900}
                height={300}
                className="mx-auto mt-4 h-64 w-full max-w-3xl rounded-3xl border border-white/10 bg-black/40"
              />
              <p className="mt-3 text-xs text-[#8a8a94]">
                <span className="text-[#c8ff3d]">— guide tone</span>
                {"  ·  "}
                <span className="text-white">— you</span>
              </p>

              {phase === "performing" && (
                <button
                  onClick={finish}
                  className="mx-auto mt-6 block w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.05] px-6 py-4 font-bold hover:bg-white/[0.08]"
                >
                  Finish early
                </button>
              )}

              {phase === "scored" && score && (
                <div className="mx-auto mt-6 max-w-md rounded-3xl border border-white/10 bg-white/[0.03] p-8">
                  <div className="text-sm font-black tracking-[0.2em] text-[#c8ff3d]">
                    GRADE {score.grade}
                  </div>
                  <div className="mt-2 text-6xl font-black tabular-nums">
                    {score.meanAbsCents}
                    <span className="text-2xl text-[#8a8a94]">¢ off</span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[#b8b8c0]">
                    Average {score.meanAbsCents} cents from the guide across{" "}
                    {score.framesScored} scored frames
                  </p>
                  <div className="mt-6 flex flex-col gap-3">
                    <button
                      onClick={() => exercise && beginExercise(exercise)}
                      className="rounded-2xl bg-[#c8ff3d] px-6 py-4 font-black text-black"
                    >
                      Run it again
                    </button>
                    <div className="flex gap-3">
                      <button
                        onClick={quitToList}
                        className="flex-1 rounded-2xl border border-white/10 bg-white/[0.05] px-6 py-3 text-sm font-bold hover:bg-white/[0.08]"
                      >
                        All exercises
                      </button>
                      <Link
                        href="/dashboard"
                        className="flex-1 rounded-2xl border border-white/10 bg-white/[0.05] px-6 py-3 text-center text-sm font-bold hover:bg-white/[0.08]"
                      >
                        My progress
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
