"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import MicCheckGate from "../components/MicCheckGate";
import { monitorBleed } from "@/lib/miccheck";
import { detectEngine, warmEngine } from "@/lib/engine";
import { frameGate, midiToNote, smoothFrequencies } from "@/lib/pitch";
import { pdLeadSeconds, pdToChart, PD_SONGS, type PDSong } from "@/lib/pdSongs";
import { scoreVsChart } from "@/lib/songchart";
import {
  HISTORY_KEY,
  recordPerformance,
  type PerformanceEntry,
} from "@/lib/history";

type Phase = "pick" | "check" | "performing" | "scored";

function gradeFor(pct: number): PerformanceEntry["grade"] {
  if (pct >= 85) return "S";
  if (pct >= 70) return "A";
  if (pct >= 55) return "B";
  if (pct >= 40) return "C";
  return "D";
}

export default function StarterPage() {
  const [song, setSong] = useState<PDSong | null>(null);
  const [phase, setPhase] = useState<Phase>("pick");
  const [note, setNote] = useState("—");
  const [tally, setTally] = useState<{ hits: number; total: number; pct: number; grade: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bleedWarn, setBleedWarn] = useState(false);

  const micContext = useRef<AudioContext | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const animationFrame = useRef<number | null>(null);
  const uiTick = useRef(frameGate(4));
  const recent = useRef<number[]>([]);
  const allFrames = useRef<Array<number | null>>([]);
  const sung = useRef<Array<{ t: number; hz: number }>>([]);
  const songRef = useRef<PDSong | null>(null);
  songRef.current = song;
  const chartRef = useRef(pdToChart(PD_SONGS[0]));
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const synthCtx = useRef<AudioContext | null>(null);
  const synthNodes = useRef<OscillatorNode[]>([]);
  const t0 = useRef(0);

  const chart = song ? pdToChart(song) : null;

  useEffect(
    () => () => {
      if (animationFrame.current !== null) {
        cancelAnimationFrame(animationFrame.current);
      }
      stream.current?.getTracks().forEach((t) => t.stop());
      micContext.current?.close();
      stopSynth();
    },
    []
  );

  function stopSynth() {
    for (const o of synthNodes.current) {
      try {
        o.stop();
      } catch {
        // Already stopped.
      }
    }
    synthNodes.current = [];
  }

  // The backing track: one soft triangle oscillator per note, gentle
  // attack/release so there are no clicks. Synthesized on-device —
  // no streams, no files, nothing to license.
  function startSynth(s: PDSong) {
    stopSynth();
    if (!synthCtx.current) {
      const AC =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      synthCtx.current = new AC();
    }
    const ctx = synthCtx.current;
    void ctx.resume();
    const spb = 60 / s.bpm;
    const now = ctx.currentTime + 0.1;
    t0.current = performance.now() / 1000;
    for (const n of s.notes) {
      const freq = 440 * Math.pow(2, (n.midi - 69) / 12);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      const start = now + pdLeadSeconds() + n.beat * spb;
      const dur = n.beats * spb;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.12, start + 0.05);
      gain.gain.setValueAtTime(0.12, start + Math.max(0.05, dur - 0.08));
      gain.gain.linearRampToValueAtTime(0, start + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + dur + 0.05);
      synthNodes.current.push(osc);
    }
  }

  function songTime(): number {
    return performance.now() / 1000 - t0.current;
  }

  async function beginCheck(s: PDSong) {
    setSong(s);
    chartRef.current = pdToChart(s);
    setTally(null);
    setError(null);
    setPhase("check");
  }

  async function startAfterCheck() {
    const s = songRef.current;
    if (!s) {
      setPhase("pick");
      return;
    }
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      stream.current = media;
      const AC =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      const context = new AC();
      micContext.current = context;
      warmEngine(context.sampleRate);
      const source = context.createMediaStreamSource(media);
      const node = context.createAnalyser();
      node.fftSize = 2048;
      source.connect(node);
      analyser.current = node;

      recent.current = [];
      allFrames.current = [];
      sung.current = [];
      setBleedWarn(false);
      setNote("—");
      startSynth(s);
      setPhase("performing");
      detectLoop();
    } catch {
      setError("Microphone access was blocked. Allow mic permission, then try again.");
      setPhase("pick");
    }
  }

  function detectLoop() {
    if (!analyser.current || !micContext.current) return;
    const paint = uiTick.current();
    const t = songTime();
    const buffer = new Float32Array(analyser.current.fftSize);
    analyser.current.getFloatTimeDomainData(buffer);
    const detected = detectEngine(buffer, micContext.current.sampleRate);

    allFrames.current.push(detected >= 70 && detected <= 800 ? detected : null);
    if (allFrames.current.length >= 300 && allFrames.current.length % 120 === 0) {
      if (monitorBleed(allFrames.current).suspect) setBleedWarn(true);
    }

    if (detected >= 70 && detected <= 800) {
      recent.current.push(detected);
      if (recent.current.length > 8) recent.current.shift();
      const list = smoothFrequencies(recent.current, 5);
      const smoothed = list[list.length - 1] ?? detected;
      sung.current.push({ t, hz: smoothed });
      if (paint) setNote(midiToNote(69 + 12 * Math.log2(smoothed / 440)));
    }

    draw(t);
    const s = songRef.current;
    const end = s ? pdLeadSeconds() + Math.max(...s.notes.map((n) => n.beat + n.beats)) * (60 / s.bpm) + 1 : Infinity;
    if (t > end) {
      finish();
      return;
    }
    animationFrame.current = requestAnimationFrame(detectLoop);
  }

  function draw(t: number) {
    const el = canvas.current;
    const s = songRef.current;
    if (!el || !s) return;
    const ctx = el.getContext("2d");
    if (!ctx) return;
    const W = (el.width = el.clientWidth * 2);
    const H = (el.height = 240);
    ctx.clearRect(0, 0, W, H);
    const midis = s.notes.map((n) => n.midi);
    const lo = Math.min(...midis) - 2;
    const hi = Math.max(...midis) + 2;
    const yOf = (m: number) => H - ((m - lo) / Math.max(1, hi - lo)) * (H - 30) - 15;
    const xOf = (tt: number) => ((tt - (t - 1)) / 4) * W;
    const blocks = chartRef.current;
    const judged = scoreVsChart(blocks, sung.current);
    const liveHz = sung.current.length > 0 ? sung.current[sung.current.length - 1].hz : null;

    blocks.forEach((b, i) => {
      if (b.end < t - 1 || b.start > t + 3) return;
      const x = xOf(b.start);
      const w = Math.max(30, xOf(b.end) - x);
      const target = 440 * Math.pow(2, (b.midi - 69) / 12);
      const past = b.end < t;
      const active = !past && b.start <= t;
      let fill = "rgba(255,255,255,0.22)";
      if (past) fill = judged[i]?.hit ? "#c8ff3d" : "rgba(255,92,105,0.55)";
      else if (active && liveHz !== null && Math.abs(1200 * Math.log2(liveHz / target)) <= 60) {
        fill = "#c8ff3d";
      }
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.roundRect(x, yOf(b.midi) - 16, w, 32, 10);
      ctx.fill();
      // Syllable on the tile — lyrics and pitch in one object.
      const lyric = s.notes[i]?.lyric ?? "";
      ctx.fillStyle = fill === "#c8ff3d" ? "#000" : "rgba(255,255,255,0.9)";
      ctx.font = "bold 20px system-ui";
      ctx.textAlign = "left";
      ctx.fillText(lyric.slice(0, 10), x + 10, yOf(b.midi) + 7);
    });

    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillRect(xOf(t) - 1, 0, 2, H);

    // Voice trace.
    const trail = sung.current.filter((p) => p.t >= t - 4 && p.t <= t);
    if (trail.length > 1) {
      ctx.lineWidth = 5;
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#fff";
      ctx.beginPath();
      trail.forEach((p, i) => {
        const m = 69 + 12 * Math.log2(p.hz / 440);
        const x = xOf(p.t);
        const y = Math.max(4, Math.min(H - 4, yOf(m)));
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }
  }

  function cleanup() {
    if (animationFrame.current !== null) {
      cancelAnimationFrame(animationFrame.current);
      animationFrame.current = null;
    }
    stopSynth();
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    micContext.current?.close();
    micContext.current = null;
  }

  function finish() {
    cleanup();
    const s = songRef.current;
    if (!s) {
      setPhase("pick");
      return;
    }
    const judged = scoreVsChart(chartRef.current, sung.current);
    const hits = judged.filter((j) => j.hit).length;
    const pct = judged.length > 0 ? Math.round((100 * hits) / judged.length) : 0;
    const grade = gradeFor(pct);
    setTally({ hits, total: judged.length, pct, grade });

    const entry: PerformanceEntry = {
      songId: `pd:${s.id}`,
      songTitle: s.title,
      accuracy: pct,
      grade,
      framesInside: hits,
      framesTotal: judged.length,
      at: Date.now(),
    };
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      const existing: PerformanceEntry[] = raw ? JSON.parse(raw) : [];
      localStorage.setItem(HISTORY_KEY, JSON.stringify(recordPerformance(existing, entry)));
    } catch {
      // History must never block the score.
    }
    setPhase("scored");
  }

  return (
    <main className="min-h-screen bg-[#070708] text-white">
      <div className="mx-auto max-w-3xl px-6 py-8">
        <header className="flex items-center justify-between">
          <Link href="/" className="text-2xl font-black tracking-[-0.06em]">
            song<span className="text-[#c8ff3d]">match</span>
          </Link>
        </header>

        <section className="mx-auto max-w-2xl pt-14 text-center">
          <h1 className="text-5xl font-black tracking-[-0.07em] text-balance">
            Starter songs.
          </h1>
          <p className="mx-auto mt-5 max-w-xl leading-7 text-[#b8b8c0]">
            Built into the app — no videos, no files, works offline.
            Earbuds in, sing the tiles.
          </p>
          {error && (
            <p role="alert" className="mx-auto mt-6 max-w-md rounded-2xl border border-[#ff5c69]/30 bg-[#ff5c69]/10 p-4 text-sm leading-6 text-[#ffb3ba]">
              {error}
            </p>
          )}

          {phase === "pick" && (
            <div className="mt-10 grid gap-3 text-left">
              {PD_SONGS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => beginCheck(s)}
                  className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-left transition hover:bg-white/[0.06]"
                >
                  <div className="text-xl font-black">{s.title}</div>
                  <div className="mt-1 text-sm text-[#b8b8c0]">
                    {s.origin} · {s.notes.length} notes · {s.bpm} BPM
                  </div>
                </button>
              ))}
            </div>
          )}

          {phase === "check" && song && (
            <div className="mt-10">
              <div className="text-xl font-black">{song.title}</div>
              <div className="mx-auto mt-6 max-w-md">
                <MicCheckGate onPass={startAfterCheck} />
              </div>
              <button
                onClick={() => setPhase("pick")}
                className="mx-auto mt-4 block text-sm font-bold text-[#8a8a94] hover:text-white"
              >
                ← Back to songs
              </button>
            </div>
          )}

          {(phase === "performing" || phase === "scored") && song && (
            <div className="mt-10">
              <div className="text-xl font-black">{song.title}</div>
              <div className="mt-2 text-7xl font-black tracking-[-0.06em] tabular-nums">
                {note}
              </div>
              {bleedWarn && phase === "performing" && (
                <p className="mx-auto mt-3 max-w-md rounded-2xl border border-[#ffc53d]/30 bg-[#ffc53d]/[0.06] p-4 text-xs leading-5 text-[#ffd98a]">
                  This looks like the backing track, not you. Plug in earbuds.
                </p>
              )}
              <canvas
                ref={canvas}
                className="mx-auto mt-6 h-56 w-full max-w-2xl rounded-3xl border border-white/10 bg-black/40"
              />
              <p className="mt-3 text-xs text-[#8a8a94]">
                <span className="text-[#c8ff3d]">Green tiles</span> — nailed
                {"  ·  "}<span className="text-white">white line</span> — your voice
              </p>
              {phase === "performing" && (
                <button
                  onClick={finish}
                  className="mx-auto mt-6 block w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.05] px-6 py-4 font-bold hover:bg-white/[0.08]"
                >
                  Finish performance
                </button>
              )}
              {phase === "scored" && tally && (
                <div className="mx-auto mt-6 max-w-md rounded-3xl border border-white/10 bg-white/[0.03] p-8">
                  <div className="text-sm font-black tracking-[0.2em] text-[#c8ff3d]">
                    GRADE {tally.grade}
                  </div>
                  <div className="mt-2 text-6xl font-black tabular-nums">
                    🎯 {tally.hits}/{tally.total}{" "}
                    <span className="text-[#c8ff3d]">{tally.pct}%</span>
                  </div>
                  <div className="mt-6 flex flex-col gap-3">
                    <button
                      onClick={() => beginCheck(song)}
                      className="rounded-2xl bg-[#c8ff3d] px-6 py-4 font-black text-black"
                    >
                      Sing it again
                    </button>
                    <Link
                      href="/dashboard"
                      className="rounded-2xl border border-white/10 bg-white/[0.05] px-6 py-3 text-sm font-bold hover:bg-white/[0.08]"
                    >
                      View my progress
                    </Link>
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
