"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import { embedUrl, parseYouTubeId } from "@/lib/youtube";
import { popularSongs, type PopularSong } from "@/lib/popular";
import { scorePerformance } from "@/lib/matching";
import {
  HISTORY_KEY,
  recordPerformance,
  type PerformanceEntry,
} from "@/lib/history";
import {
  detectPitch,
  midiToNote,
  pitchSteadiness,
  smoothFrequencies,
} from "@/lib/pitch";

type Phase = "pick" | "performing" | "scored";

type ScoreView = {
  accuracy: number;
  grade: string;
  detail: string;
};

export default function PopularPage() {
  const [phase, setPhase] = useState<Phase>("pick");
  const [song, setSong] = useState<PopularSong | null>(null);
  const [videoId, setVideoId] = useState("");
  const [link, setLink] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("—");
  const [score, setScore] = useState<ScoreView | null>(null);

  const micContext = useRef<AudioContext | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const animationFrame = useRef<number | null>(null);
  const frames = useRef<number[]>([]);
  const recent = useRef<number[]>([]);
  const line = useRef<number[]>([]);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const songRef = useRef<PopularSong | null>(null);
  songRef.current = song;

  function draw() {
    const el = canvas.current;
    if (!el) return;
    const ctx = el.getContext("2d");
    if (!ctx) return;

    const W = el.width;
    const H = el.height;
    const min = Math.log2(70);
    const max = Math.log2(800);
    const yOf = (f: number) =>
      H - 8 - ((Math.log2(f) - min) / (max - min)) * (H - 16);

    ctx.clearRect(0, 0, W, H);

    for (let midi = 36; midi <= 96; midi++) {
      const f = 440 * Math.pow(2, (midi - 69) / 12);
      if (f < 70 || f > 800) continue;
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

    // Comfort-zone band for database songs
    const s = songRef.current;
    if (s) {
      const yTop = yOf(440 * Math.pow(2, (s.tessituraHighMidi - 69) / 12));
      const yBot = yOf(440 * Math.pow(2, (s.tessituraLowMidi - 69) / 12));
      ctx.fillStyle = "rgba(200,255,61,0.08)";
      ctx.fillRect(0, yTop, W, yBot - yTop);
    }

    const pts = line.current;
    if (pts.length > 1) {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.lineJoin = "round";
      ctx.beginPath();
      pts.forEach((f, i) => {
        const x = (i / 179) * W;
        const y = yOf(Math.max(70, Math.min(800, f)));
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }
  }

  function detectLoop() {
    if (!analyser.current || !micContext.current) return;
    const buffer = new Float32Array(analyser.current.fftSize);
    analyser.current.getFloatTimeDomainData(buffer);
    const detected = detectPitch(buffer, micContext.current.sampleRate);

    if (detected >= 70 && detected <= 800) {
      frames.current.push(detected);
      recent.current.push(detected);
      if (recent.current.length > 8) recent.current.shift();
      const list = smoothFrequencies(recent.current, 5);
      const smoothed = list[list.length - 1] ?? detected;
      setNote(midiToNote(69 + 12 * Math.log2(smoothed / 440)));
      line.current.push(smoothed);
      if (line.current.length > 180) line.current.shift();
      draw();
    }

    animationFrame.current = requestAnimationFrame(detectLoop);
  }

  async function startMic(): Promise<boolean> {
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
      return true;
    } catch {
      setError(
        "Microphone access was blocked. Allow mic permission, then try again."
      );
      return false;
    }
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

  async function beginSong(s: PopularSong | null, vid: string) {
    setError(null);
    setScore(null);
    if (!(await startMic())) return;
    setSong(s);
    setVideoId(vid);
    frames.current = [];
    recent.current = [];
    line.current = [];
    setNote("—");
    setPhase("performing");
    detectLoop();
  }

  function submitLink() {
    const id = parseYouTubeId(link);
    if (!id) {
      setLinkError("That doesn't look like a YouTube link or video ID.");
      return;
    }
    setLinkError(null);
    beginSong(null, id);
  }

  function finish() {
    cleanupMic();
    const s = songRef.current;
    const steadiness = pitchSteadiness(frames.current);
    let view: ScoreView | null = null;

    if (s && frames.current.length >= 3) {
      const r = scorePerformance(frames.current, s);
      if (r) {
        view = {
          accuracy: r.accuracy,
          grade: r.grade,
          detail: `${r.framesInside} of ${r.framesTotal} frames inside ${midiToNote(s.tessituraLowMidi)}–${midiToNote(s.tessituraHighMidi)}${steadiness !== null ? ` · steadiness ${steadiness}%` : ""}`,
        };
      }
    } else if (steadiness !== null && frames.current.length >= 3) {
      const grade =
        steadiness >= 85 ? "S"
        : steadiness >= 70 ? "A"
        : steadiness >= 55 ? "B"
        : steadiness >= 40 ? "C"
        : "D";
      view = {
        accuracy: steadiness,
        grade,
        detail: `Pitch steadiness across ${frames.current.length} frames — no range data for custom links yet.`,
      };
    }

    if (!view) {
      setError("We didn't catch your voice. Wear earbuds and try again.");
      setPhase("pick");
      return;
    }

    const title = s ? `${s.title} — ${s.artist}` : "Custom YouTube track";
    const entry: PerformanceEntry = {
      songId: s ? `yt:${s.id}` : `yt:link:${videoId}`,
      songTitle: title,
      accuracy: view.accuracy,
      grade: view.grade as PerformanceEntry["grade"],
      framesInside: frames.current.length,
      framesTotal: frames.current.length,
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
    setScore(view);
    setPhase("scored");
  }

  useEffect(
    () => () => {
      cleanupMic();
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
          <div className="flex items-center gap-5">
            <Link
              href="/dashboard"
              className="text-sm text-[#b8b8c0] hover:text-white"
            >
              Dashboard
            </Link>
            <Link
              href="/matches"
              className="text-sm text-[#b8b8c0] hover:text-white"
            >
              Matches
            </Link>
          </div>
        </header>

        <section className="mx-auto max-w-3xl pt-20 text-center">
          <h1 className="text-5xl font-black tracking-[-0.07em] text-balance">
            Sing the songs you love.
          </h1>
          <p className="mx-auto mt-5 max-w-xl leading-7 text-[#b8b8c0]">
            Pick a track — it plays from YouTube, you sing along, we track
            your pitch live and score you. Wear earbuds so the mic hears
            you, not the track.
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
            <div className="mt-10 text-left">
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
                <div className="text-sm font-black">Paste a YouTube link</div>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <input
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    placeholder="youtube.com/watch?v=… or youtu.be/…"
                    className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-[#8a8a94] focus:border-[#c8ff3d]/60 focus:outline-none"
                  />
                  <button
                    onClick={submitLink}
                    className="shrink-0 rounded-xl bg-[#c8ff3d] px-6 py-3 text-sm font-black text-black"
                  >
                    Sing this →
                  </button>
                </div>
                {linkError && (
                  <p role="alert" className="mt-2 text-xs text-[#ffb3ba]">
                    {linkError}
                  </p>
                )}
              </div>

              <h2 className="mt-10 text-2xl font-black tracking-tight">
                Popular tracks
              </h2>
              <p className="mt-2 text-xs text-[#8a8a94]">
                Ranges marked ~ are community estimates; the rest are measured.
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {popularSongs.map((s) => (
                  <div
                    key={s.id}
                    className="rounded-3xl border border-white/10 bg-white/[0.03] p-5"
                  >
                    <div className="text-lg font-black">{s.title}</div>
                    <div className="mt-0.5 text-sm text-[#b8b8c0]">
                      {s.artist}
                    </div>
                    <div className="mt-2 text-xs text-[#8a8a94]">
                      Key {s.key} · {s.rangeEstimate ? "~" : ""}
                      {midiToNote(s.vocalLowMidi)}–
                      {midiToNote(s.vocalHighMidi)} · {s.difficulty}
                    </div>
                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() => {
                          const q = encodeURIComponent(
                            `${s.title} ${s.artist} official`
                          );
                          window.open(
                            `https://www.youtube.com/results?search_query=${q}`,
                            "_blank",
                            "noopener"
                          );
                        }}
                        className="flex-1 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm font-bold hover:bg-white/[0.08]"
                      >
                        Find on YouTube
                      </button>
                    </div>
                    <p className="mt-2 text-[11px] leading-5 text-[#8a8a94]">
                      Open the video, copy its link, paste it above — the
                      track then plays here with live scoring.
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(phase === "performing" || phase === "scored") && (
            <div className="mt-10">
              {song && (
                <div className="text-xl font-black">
                  {song.title}{" "}
                  <span className="font-normal text-[#b8b8c0]">
                    · {song.artist}
                  </span>
                </div>
              )}
              <div className="mx-auto mt-4 aspect-video w-full max-w-2xl overflow-hidden rounded-3xl border border-white/10 bg-black">
                <iframe
                  key={videoId}
                  src={`${embedUrl(videoId)}&autoplay=${phase === "performing" ? 1 : 0}`}
                  title="Song playback"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="h-full w-full"
                />
              </div>

              <div className="mt-6 text-6xl font-black tracking-[-0.06em]">
                {note}
              </div>

              <canvas
                ref={canvas}
                width={900}
                height={260}
                className="mx-auto mt-4 h-52 w-full max-w-3xl rounded-3xl border border-white/10 bg-black/40"
              />
              <p className="mt-3 text-xs text-[#8a8a94]">
                <span className="text-white">— your voice</span>
                {song && (
                  <>
                    {"  ·  "}
                    <span className="text-[#c8ff3d]">
                      shaded band = hold zone (
                      {midiToNote(song.tessituraLowMidi)}–
                      {midiToNote(song.tessituraHighMidi)})
                    </span>
                  </>
                )}
              </p>

              {phase === "performing" && (
                <button
                  onClick={finish}
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
                    {score.accuracy}
                    <span className="text-2xl text-[#8a8a94]">%</span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[#b8b8c0]">
                    {score.detail}
                  </p>
                  <div className="mt-6 flex flex-col gap-3">
                    <Link
                      href="/dashboard"
                      className="rounded-2xl bg-[#c8ff3d] px-6 py-4 font-black text-black"
                    >
                      View my progress
                    </Link>
                    <button
                      onClick={() => setPhase("pick")}
                      className="rounded-2xl border border-white/10 bg-white/[0.05] px-6 py-3 text-sm font-bold hover:bg-white/[0.08]"
                    >
                      Sing another track
                    </button>
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
