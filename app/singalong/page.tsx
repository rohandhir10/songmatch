"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import {
  extractContourAsync,
  scoreAgainstContour,
  type ContourScore,
  type LiveFrame,
  type ReferenceContour,
} from "@/lib/contour";
import {
  HISTORY_KEY,
  recordPerformance,
  type PerformanceEntry,
} from "@/lib/history";
import {
  centsOffNearest,
  detectPitch,
  midiToNote,
  smoothFrequencies,
} from "@/lib/pitch";

type Phase = "pick" | "analyzing" | "ready" | "performing" | "scored";

const PAST = 2;
const AHEAD = 4;

export default function SingAlongPage() {
  const [phase, setPhase] = useState<Phase>("pick");
  const [fileName, setFileName] = useState("");
  const [progress, setProgress] = useState(0);
  const [contour, setContour] = useState<ReferenceContour | null>(null);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("—");
  const [devCents, setDevCents] = useState<number | null>(null);
  const [score, setScore] = useState<ContourScore | null>(null);

  const audio = useRef<HTMLAudioElement | null>(null);
  const objectUrl = useRef<string | null>(null);
  const decodeContext = useRef<AudioContext | null>(null);

  const micContext = useRef<AudioContext | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const animationFrame = useRef<number | null>(null);
  const live = useRef<LiveFrame[]>([]);
  const recent = useRef<number[]>([]);
  const canvas = useRef<HTMLCanvasElement | null>(null);

  function contourAt(ref: ReferenceContour, t: number): number | null {
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
    const ref = contour;
    if (!el || !ref) return;
    const ctx = el.getContext("2d");
    if (!ctx) return;

    const W = el.width;
    const H = el.height;
    const t0 = t - PAST;
    const t1 = t + AHEAD;
    const xOf = (tt: number) => ((tt - t0) / (t1 - t0)) * W;

    // Visible pitch range from the reference in view
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

    // Semitone grid with C labels
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

    // Now-line
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(xOf(t), 0);
    ctx.lineTo(xOf(t), H);
    ctx.stroke();

    // Reference contour (lime), broken at gaps
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

    // Live voice overlay (white), trailing behind now
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
    if (!analyser.current || !micContext.current || !audio.current) return;
    const t = audio.current.currentTime;

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

      const ref = contour ? contourAt(contour, t) : null;
      if (ref !== null && ref !== undefined && ref > 0) {
        setDevCents(Math.round(1200 * Math.log2(smoothed / ref)));
      } else {
        setDevCents(null);
      }
    } else {
      setDevCents(null);
    }

    draw(t);
    animationFrame.current = requestAnimationFrame(detectLoop);
  }

  async function handleFile(file: File) {
    setError(null);
    setFileName(file.name);
    setScore(null);

    const cacheKey = `songmatch-contour:${file.name}:${file.size}:${file.lastModified}`;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached) as ReferenceContour;
        if (parsed.points?.length > 0) {
          setContour(parsed);
          setDuration(
            parsed.points[parsed.points.length - 1].t
          );
          if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
          objectUrl.current = URL.createObjectURL(file);
          setPhase("ready");
          return;
        }
      }
    } catch {
      // Corrupt cache: fall through to analysis.
    }

    setPhase("analyzing");
    setProgress(0);
    try {
      if (!decodeContext.current) {
        decodeContext.current = new AudioContext();
      }
      const raw = new Uint8Array(await file.arrayBuffer());
      // decodeAudioData needs a copy (it detaches the buffer)
      const buf = await decodeContext.current.decodeAudioData(raw.buffer);
      const left = buf.getChannelData(0);
      const right =
        buf.numberOfChannels > 1 ? buf.getChannelData(1) : buf.getChannelData(0);
      const ref = await extractContourAsync(
        left,
        right,
        buf.sampleRate,
        (done, total) => setProgress(total === 0 ? 0 : done / total)
      );
      if (ref.points.filter((p) => p.freq !== null).length < 10) {
        throw new Error(
          "Couldn't find a clear vocal line — try a track with a prominent centered voice."
        );
      }
      try {
        localStorage.setItem(cacheKey, JSON.stringify(ref));
      } catch {
        // Quota: analysis still works for this session.
      }
      setContour(ref);
      setDuration(buf.duration);
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
      objectUrl.current = URL.createObjectURL(file);
      setPhase("ready");
    } catch (e) {
      setPhase("pick");
      setError(
        e instanceof Error
          ? e.message
          : "Couldn't read that file. Try MP3, M4A, WAV or OGG."
      );
    }
  }

  async function startPerformance() {
    if (!audio.current) return;
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
      const context = new AudioContextClass();
      micContext.current = context;
      const source = context.createMediaStreamSource(media);
      const node = context.createAnalyser();
      node.fftSize = 2048;
      source.connect(node);
      analyser.current = node;

      live.current = [];
      recent.current = [];
      setScore(null);
      setError(null);
      setNote("—");
      setDevCents(null);
      setPhase("performing");
      await audio.current.play();
      detectLoop();
    } catch {
      setError(
        "Microphone access was blocked. Allow mic permission, then try again."
      );
    }
  }

  function stopPerformance() {
    if (animationFrame.current !== null) {
      cancelAnimationFrame(animationFrame.current);
      animationFrame.current = null;
    }
    audio.current?.pause();
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    micContext.current?.close();
    micContext.current = null;

    if (!contour) {
      setPhase("ready");
      return;
    }
    const result = scoreAgainstContour(live.current, contour);
    if (!result) {
      setError("We didn't catch your voice. Wear earbuds and sing along again.");
      setPhase("ready");
      return;
    }
    const entry: PerformanceEntry = {
      songId: `file:${fileName}`,
      songTitle: fileName.replace(/\.[^.]+$/, ""),
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

  useEffect(() => {
    const el = audio.current;
    if (!el) return;
    const onEnded = () => {
      if (live.current.length > 0) stopPerformance();
    };
    el.addEventListener("ended", onEnded);
    return () => el.removeEventListener("ended", onEnded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, contour]);

  useEffect(
    () => () => {
      if (animationFrame.current !== null) {
        cancelAnimationFrame(animationFrame.current);
      }
      stream.current?.getTracks().forEach((t) => t.stop());
      micContext.current?.close();
      decodeContext.current?.close();
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    },
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
            Sing along to your music.
          </h1>
          <p className="mx-auto mt-5 max-w-xl leading-7 text-[#b8b8c0]">
            Pick any song file you own. We lift the vocal line out of it,
            scroll it live as the track plays, and score your pitch
            note-for-note. Wear earbuds so the mic hears you, not the track.
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
            <label className="mx-auto mt-10 block max-w-md cursor-pointer rounded-3xl border border-dashed border-white/20 bg-white/[0.03] p-10 transition hover:border-[#c8ff3d]/50 hover:bg-white/[0.05]">
              <span className="block text-lg font-black">
                Choose a song file →
              </span>
              <span className="mt-2 block text-sm text-[#b8b8c0]">
                MP3, M4A, WAV or OGG from your device. It never leaves it.
              </span>
              <input
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                  e.target.value = "";
                }}
              />
            </label>
          )}

          {phase === "analyzing" && (
            <div className="mx-auto mt-10 max-w-md rounded-3xl border border-white/10 bg-white/[0.03] p-10">
              <div className="text-sm font-black tracking-[0.2em] text-[#c8ff3d]">
                FINDING THE VOCAL
              </div>
              <p className="mt-3 truncate text-sm text-[#b8b8c0]">{fileName}</p>
              <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-[#c8ff3d] transition-[width]"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </div>
              <p className="mt-3 text-xs text-[#8a8a94] tabular-nums">
                {Math.round(progress * 100)}% · one-time per song
              </p>
            </div>
          )}

          {phase === "ready" && (
            <div className="mx-auto mt-10 max-w-md rounded-3xl border border-white/10 bg-white/[0.03] p-10">
              <div className="truncate text-xl font-black">{fileName}</div>
              <p className="mt-2 text-sm text-[#b8b8c0]">
                Vocal line locked · {Math.round(duration)}s
              </p>
              <button
                onClick={startPerformance}
                className="mt-6 w-full rounded-2xl bg-[#c8ff3d] px-6 py-4 text-lg font-black text-black transition hover:-translate-y-1"
              >
                Sing it →
              </button>
              <button
                onClick={() => setPhase("pick")}
                className="mt-3 w-full rounded-2xl border border-white/10 bg-white/[0.05] px-6 py-3 text-sm font-bold hover:bg-white/[0.08]"
              >
                Choose a different song
              </button>
            </div>
          )}

          {(phase === "performing" || phase === "scored") && (
            <div className="mt-10">
              <div className="flex items-baseline justify-center gap-6">
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
                className="mx-auto mt-6 h-64 w-full max-w-3xl rounded-3xl border border-white/10 bg-black/40"
              />
              <p className="mt-3 text-xs text-[#8a8a94]">
                <span className="text-[#c8ff3d]">— original vocal</span>
                {"  ·  "}
                <span className="text-white">— you</span>
              </p>

              {phase === "performing" && (
                <button
                  onClick={stopPerformance}
                  className="mx-auto mt-6 block w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.05] px-6 py-4 font-bold hover:bg-white/[0.08]"
                >
                  Finish performance
                </button>
              )}

              {phase === "scored" && score && (
                <div className="mx-auto mt-6 max-w-md rounded-3xl border border-white/10 bg-white/[0.03] p-8">
                  <div className="text-sm font-black tracking-[0.2em] text-[#c8ff3d]">
                    GRADE {score.grade}
                  </div>
                  <div className="mt-2 text-6xl font-black tabular-nums">
                    {Math.max(0, 100 - Math.round(score.meanAbsCents))}
                    <span className="text-2xl text-[#8a8a94]">%</span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[#b8b8c0]">
                    Average {score.meanAbsCents} cents from the original
                    across {score.framesScored} scored frames
                  </p>
                  <div className="mt-6 flex flex-col gap-3">
                    <button
                      onClick={startPerformance}
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

          <audio
            ref={audio}
            src={objectUrl.current ?? undefined}
            preload="auto"
          />
        </section>
      </div>
    </main>
  );
}
