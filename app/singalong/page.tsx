"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import MicCheckGate from "../components/MicCheckGate";
import { monitorBleed } from "@/lib/miccheck";
import LyricsField from "../components/LyricsField";
import { activeLyric, wordTimings, type LrcSong } from "@/lib/lrc";
import { reduceVocals } from "@/lib/karaokeMix";
import { contourToNotes, scoreNoteHits, type NoteBlock } from "@/lib/notes";
import { encodeWavPcm16 } from "@/lib/wav";
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
  frameGate,
  midiToNote,
  smoothFrequencies,
} from "@/lib/pitch";

type Phase = "pick" | "analyzing" | "ready" | "check" | "performing" | "scored";

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
  const [bleedWarn, setBleedWarn] = useState(false);
  const [lrc, setLrc] = useState<LrcSong | null>(null);
  const [lyric, setLyric] = useState<{
    text: string;
    next: string | null;
    index: number;
  } | null>(null);
  const devSamples = useRef<Array<{ t: number; dev: number }>>([]);
  const [trackMode, setTrackMode] = useState<"original" | "karaoke">("original");
  const [karaokeUrl, setKaraokeUrl] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [notes, setNotes] = useState<NoteBlock[]>([]);
  const notesRef = useRef<NoteBlock[]>([]);
  notesRef.current = notes;
  const sungRef = useRef<Array<{ t: number; hz: number }>>([]);
  const lastSung = useRef<number | null>(null);
  const noteCanvas = useRef<HTMLCanvasElement | null>(null);

  const audio = useRef<HTMLAudioElement | null>(null);
  const objectUrl = useRef<string | null>(null);
  const karaokeObjectUrl = useRef<string | null>(null);
  const audioBytes = useRef<Uint8Array | null>(null);
  const decodeContext = useRef<AudioContext | null>(null);

  const micContext = useRef<AudioContext | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const animationFrame = useRef<number | null>(null);
  const live = useRef<LiveFrame[]>([]);
  const recent = useRef<number[]>([]);
  const allFrames = useRef<Array<number | null>>([]);
  const uiTick = useRef(frameGate(4));
  const lrcRef = useRef<LrcSong | null>(null);
  lrcRef.current = lrc;
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
    const paint = uiTick.current();
    const t = audio.current.currentTime;

    const buffer = new Float32Array(analyser.current.fftSize);
    analyser.current.getFloatTimeDomainData(buffer);
    const detected = detectPitch(buffer, micContext.current.sampleRate);

    allFrames.current.push(
      detected >= 70 && detected <= 800 ? detected : null
    );
    if (
      allFrames.current.length >= 300 &&
      allFrames.current.length % 120 === 0
    ) {
      if (monitorBleed(allFrames.current).suspect) {
        setBleedWarn(true);
      }
    }

    if (detected >= 70 && detected <= 800) {
      recent.current.push(detected);
      if (recent.current.length > 8) recent.current.shift();
      const list = smoothFrequencies(recent.current, 5);
      const smoothed = list[list.length - 1] ?? detected;
      if (paint) {
        setNote(midiToNote(69 + 12 * Math.log2(smoothed / 440)));
      }
      live.current.push({ t, freq: smoothed });
      lastSung.current = smoothed;
      if (paint) {
        sungRef.current.push({ t, hz: smoothed });
        if (sungRef.current.length > 7200) {
          sungRef.current.splice(0, sungRef.current.length - 7200);
        }
      }

      const ref = contour ? contourAt(contour, t) : null;
      if (paint) {
        if (ref !== null && ref !== undefined && ref > 0) {
          const dev = Math.round(1200 * Math.log2(smoothed / ref));
          setDevCents(dev);
          devSamples.current.push({ t, dev });
          if (devSamples.current.length > 3600) {
            devSamples.current.splice(0, devSamples.current.length - 3600);
          }
        } else {
          setDevCents(null);
        }
        if (lrcRef.current) {
          setLyric(activeLyric(lrcRef.current, t));
        }
      }
    } else {
      lastSung.current = null;
      if (paint) {
        setDevCents(null);
      }
    }

    draw(t);
    drawHighway(t, lastSung.current);
    animationFrame.current = requestAnimationFrame(detectLoop);
  }

  // StarMaker note highway: song notes scroll right-to-left, lighting
  // green the instant your voice lands on them.
  function drawHighway(t: number, sungHz: number | null) {
    const el = noteCanvas.current;
    const blocks = notesRef.current;
    if (!el || blocks.length === 0) return;
    const ctx = el.getContext("2d");
    if (!ctx) return;
    const W = (el.width = el.clientWidth * 2);
    const H = (el.height = 220);
    ctx.clearRect(0, 0, W, H);

    const midis = blocks.map((b) => b.midi);
    const lo = Math.min(...midis) - 2;
    const hi = Math.max(...midis) + 2;
    const yOf = (m: number) => H - ((m - lo) / Math.max(1, hi - lo)) * (H - 30) - 15;
    // 1s of past, 3s of future; the "now" line sits 25% from the left.
    const xOf = (tt: number) => ((tt - (t - 1)) / 4) * W;

    const judged = scoreNoteHits(blocks, sungRef.current);
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      if (b.end < t - 1 || b.start > t + 3) continue;
      const x = xOf(b.start);
      const w = Math.max(6, xOf(b.end) - x);
      const target = 440 * Math.pow(2, (b.midi - 69) / 12);
      const y = yOf(b.midi) - 11;
      const past = b.end < t;
      const active = !past && b.start <= t;
      let fill = "rgba(255,255,255,0.22)"; // upcoming
      if (past) {
        fill = judged[i]?.hit ? "#c8ff3d" : "rgba(255,92,105,0.55)";
      } else if (
        active &&
        sungHz !== null &&
        Math.abs(1200 * Math.log2(sungHz / target)) <= 60
      ) {
        fill = "#c8ff3d"; // hitting it right now
      }
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.roundRect(x, y, w, 22, 11);
      ctx.fill();
      if (active && fill !== "#c8ff3d") {
        ctx.strokeStyle = "rgba(255,255,255,0.8)";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
    // now-line
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillRect(xOf(t) - 1, 0, 2, H);
  }

  async function handleFile(file: File) {
    setError(null);
    setFileName(file.name);
    setScore(null);
    setLrc(null);
    setLyric(null);
    setTrackMode("original");
    setKaraokeUrl(null);
    if (karaokeObjectUrl.current) {
      URL.revokeObjectURL(karaokeObjectUrl.current);
      karaokeObjectUrl.current = null;
    }

    const cacheKey = `songmatch-contour:${file.name}:${file.size}:${file.lastModified}`;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached) as ReferenceContour;
        if (parsed.points?.length > 0) {
          setContour(parsed);
          setNotes(contourToNotes(parsed.points));
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
      audioBytes.current = raw;
      // decodeAudioData needs a fresh ArrayBuffer (it detaches the
      // buffer, and .buffer may be a SharedArrayBuffer view instead).
      const copy = new ArrayBuffer(raw.byteLength);
      new Uint8Array(copy).set(raw);
      const buf = await decodeContext.current.decodeAudioData(copy);
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
      setNotes(contourToNotes(ref.points));
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

  async function buildKaraokeMix(): Promise<string | null> {
    if (karaokeObjectUrl.current) return karaokeObjectUrl.current;
    if (!audioBytes.current || !decodeContext.current) return null;
    setPreparing(true);
    try {
      const bytes = audioBytes.current;
      const copy = new ArrayBuffer(bytes.byteLength);
      new Uint8Array(copy).set(bytes);
      const buf = await decodeContext.current.decodeAudioData(copy);
      const left = buf.getChannelData(0);
      const right =
        buf.numberOfChannels > 1 ? buf.getChannelData(1) : buf.getChannelData(0);
      const backing = reduceVocals(left, right);
      const wav = encodeWavPcm16(backing, buf.sampleRate);
      const url = URL.createObjectURL(
        new Blob([wav as unknown as BlobPart], { type: "audio/wav" })
      );
      karaokeObjectUrl.current = url;
      setKaraokeUrl(url);
      return url;
    } catch {
      setError("Couldn't build the karaoke mix from this file.");
      return null;
    } finally {
      setPreparing(false);
    }
  }

  // Sound check first: the track plays and we verify the mic hears
  // the room, not the speakers. Performing on a bleeding mic just
  // traces the song and drowns the voice.
  async function beginCheck() {
    if (!audio.current) return;
    setError(null);
    setScore(null);
    try {
      audio.current.currentTime = 0;
      await audio.current.play();
      setPhase("check");
    } catch {
      setError("Couldn't start playback. Try again.");
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
      allFrames.current = [];
      devSamples.current = [];
      sungRef.current = [];
      lastSung.current = null;
      setScore(null);
      setError(null);
      setNote("—");
      setDevCents(null);
      setLyric(null);
      setBleedWarn(false);
      audio.current.pause();
      audio.current.currentTime = 0;
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
      if (karaokeObjectUrl.current) {
        URL.revokeObjectURL(karaokeObjectUrl.current);
        karaokeObjectUrl.current = null;
      }
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
                onClick={beginCheck}
                className="mt-6 w-full rounded-2xl bg-[#c8ff3d] px-6 py-4 text-lg font-black text-black transition hover:-translate-y-1"
              >
                Sing it →
              </button>
              <div
                role="group"
                aria-label="Backing track"
                className="mx-auto mt-3 inline-flex rounded-full border border-white/10 bg-white/[0.04] p-1"
              >
                <button
                  onClick={() => setTrackMode("original")}
                  aria-pressed={trackMode === "original"}
                  className={
                    trackMode === "original"
                      ? "rounded-full bg-[#c8ff3d] px-4 py-1.5 text-xs font-black text-black"
                      : "rounded-full px-4 py-1.5 text-xs font-bold text-[#b8b8c0] hover:text-white"
                  }
                >
                  Original
                </button>
                <button
                  onClick={async () => {
                    if (trackMode === "karaoke") return;
                    const url = await buildKaraokeMix();
                    if (url) setTrackMode("karaoke");
                  }}
                  aria-pressed={trackMode === "karaoke"}
                  disabled={preparing}
                  className={
                    trackMode === "karaoke"
                      ? "rounded-full bg-[#c8ff3d] px-4 py-1.5 text-xs font-black text-black"
                      : "rounded-full px-4 py-1.5 text-xs font-bold text-[#b8b8c0] hover:text-white disabled:opacity-50"
                  }
                >
                  {preparing ? "Mixing…" : "Karaoke mix"}
                </button>
              </div>
              <p className="mt-2 text-[11px] leading-5 text-[#8a8a94]">
                Karaoke mix drops the centered vocal out of your file —
                quality depends on the mix.
              </p>
              <LyricsField lrc={lrc} onLoad={setLrc} onError={setError} />
              <button
                onClick={() => setPhase("pick")}
                className="mt-3 w-full rounded-2xl border border-white/10 bg-white/[0.05] px-6 py-3 text-sm font-bold hover:bg-white/[0.08]"
              >
                Choose a different song
              </button>
            </div>
          )}

          {phase === "check" && (
            <div className="mt-10">
              <div className="truncate text-xl font-black">{fileName}</div>
              <div className="mx-auto mt-6 max-w-md">
                <MicCheckGate
                  onPass={() => {
                    audio.current?.pause();
                    startPerformance();
                  }}
                />
              </div>
              <button
                onClick={() => {
                  audio.current?.pause();
                  setPhase("ready");
                }}
                className="mx-auto mt-4 block text-sm font-bold text-[#8a8a94] hover:text-white"
              >
                ← Back
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

              {bleedWarn && phase === "performing" && (
                <div className="mx-auto mt-4 max-w-md rounded-2xl border border-[#ffc53d]/30 bg-[#ffc53d]/[0.06] p-4 text-left">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-xs leading-5 text-[#ffd98a]">
                      This looks like the track, not you — continuous and
                      breathless. Plug in earbuds if you haven&apos;t.
                    </p>
                    <button
                      onClick={() => setBleedWarn(false)}
                      aria-label="Dismiss"
                      className="shrink-0 rounded-full border border-white/10 px-2.5 py-1 text-xs text-[#b8b8c0] hover:text-white"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}

              {lyric && phase === "performing" && lrc && (
                <div className="mx-auto mt-6 max-w-2xl">
                  <WordLine
                    lrc={lrc}
                    index={lyric.index}
                    samples={devSamples.current}
                  />
                  {lyric.next && (
                    <div className="mt-2 text-base font-bold text-[#8a8a94]">
                      {lyric.next}
                    </div>
                  )}
                </div>
              )}

              {notes.length > 0 && phase === "performing" && (
                <>
                  <canvas
                    ref={noteCanvas}
                    className="mx-auto mt-6 h-28 w-full max-w-3xl rounded-3xl border border-white/10 bg-black/40"
                  />
                  <p className="mt-3 text-xs text-[#8a8a94]">
                    Hit the blocks — they light{" "}
                    <span className="font-bold text-[#c8ff3d]">green</span>{" "}
                    when your voice lands on them
                  </p>
                </>
              )}

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
                  {notes.length > 0 && (
                    <NoteHitLine
                      notes={notes}
                      sung={sungRef.current}
                    />
                  )}
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
            src={
              trackMode === "karaoke" && karaokeUrl
                ? karaokeUrl
                : (objectUrl.current ?? undefined)
            }
            preload="auto"
          />
        </section>
      </div>
    </main>
  );
}

// Final note-hit tally: how many of the song's notes the voice landed.
function NoteHitLine({
  notes,
  sung,
}: {
  notes: NoteBlock[];
  sung: Array<{ t: number; hz: number }>;
}) {
  const judged = scoreNoteHits(notes, sung);
  const hits = judged.filter((j) => j.hit).length;
  const pct =
    judged.length > 0 ? Math.round((100 * hits) / judged.length) : 0;
  return (
    <p className="mt-4 text-lg font-black tabular-nums">
      🎯 {hits}/{judged.length} notes{" "}
      <span className="text-[#c8ff3d]">{pct}%</span>
    </p>
  );
}

// Per-word hit display: words light as their time arrives, colored by how
// in-tune the voice was during each word's window — lime nailed, amber
// close, red off, dim for words with no voice at all.
function WordLine({
  lrc,
  index,
  samples,
}: {
  lrc: LrcSong;
  index: number;
  samples: Array<{ t: number; dev: number }>;
}) {
  const line = lrc.lines[index];
  if (!line) return null;
  const nextStart =
    index + 1 < lrc.lines.length ? lrc.lines[index + 1].t : null;
  const words = wordTimings(line, nextStart);
  const nowT =
    samples.length > 0 ? samples[samples.length - 1].t : line.t;

  return (
    <p className="text-3xl font-black leading-snug tracking-tight text-balance">
      {words.map((w, i) => {
        const end = i + 1 < words.length ? words[i + 1].t : nextStart ?? w.t + 4;
        const inWindow = samples.filter((s) => s.t >= w.t && s.t < end);
        let color = "#8a8a94"; // future or unattempted
        if (w.t <= nowT) {
          if (inWindow.length === 0) {
            color = "#55555e"; // missed entirely
          } else {
            const mean =
              inWindow.reduce((sum, s) => sum + Math.abs(s.dev), 0) /
              inWindow.length;
            color =
              mean <= 40 ? "#c8ff3d" : mean <= 80 ? "#ffc53d" : "#ff5c69";
          }
        }
        return (
          <span key={`${w.t}-${w.word}`} style={{ color }}>
            {w.word}
            {i + 1 < words.length ? " " : ""}
          </span>
        );
      })}
    </p>
  );
}
