"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import { embedUrl, parseYouTubeId } from "@/lib/youtube";
import { GENRES, popularSongs, type Genre, type PopularSong } from "@/lib/popular";
import MicCheckGate from "../components/MicCheckGate";
import LevelPicker from "../components/LevelPicker";
import LyricsField from "../components/LyricsField";
import { activeLyric, parseLrc, wordTimings, type LrcSong } from "@/lib/lrc";
import { cacheLrc, cachedLrc, fetchLrcText } from "@/lib/lyrics";
import {
  loadOffset,
  offsetKey,
  stepOffset,
} from "@/lib/lyricOffset";
import { arrangeForLevel, type Level } from "@/lib/levels";
import { scoreSongPerformance } from "@/lib/matching";
import { monitorBleed } from "@/lib/miccheck";
import {
  HISTORY_KEY,
  recordPerformance,
  type PerformanceEntry,
} from "@/lib/history";
import {
  detectPitch,
  frameGate,
  midiToNote,
  pitchSteadiness,
  smoothFrequencies,
} from "@/lib/pitch";

type Phase = "pick" | "check" | "performing" | "scored";

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
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState<Genre | "All">("All");
  const [sort, setSort] = useState<"az" | "easy" | "span">("az");
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("—");
  const [score, setScore] = useState<ScoreView | null>(null);
  const [runId, setRunId] = useState(0);
  const [bleedWarn, setBleedWarn] = useState(false);
  const [level, setLevel] = useState<Level>("Standard");
  const [lrc, setLrc] = useState<LrcSong | null>(null);
  const [lyric, setLyric] = useState<{
    text: string;
    next: string | null;
    index: number;
  } | null>(null);
  const [lyricsState, setLyricsState] = useState<
    "idle" | "loading" | "ready" | "missing"
  >("idle");

  const micContext = useRef<AudioContext | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const animationFrame = useRef<number | null>(null);
  const frames = useRef<number[]>([]);
  const recent = useRef<number[]>([]);
  const line = useRef<number[]>([]);
  const allFrames = useRef<Array<number | null>>([]);
  const uiTick = useRef(frameGate(4));
  const canvas = useRef<HTMLCanvasElement | null>(null);
  function currentOffsetKey(): string {
    return offsetKey(songRef.current?.id ?? null, videoId);
  }
  const songRef = useRef<PopularSong | null>(null);
  songRef.current = song;
  const lrcRef = useRef<LrcSong | null>(null);
  lrcRef.current = lrc;
  const ytFrame = useRef<HTMLIFrameElement | null>(null);
  const ytPlayer = useRef<{ getCurrentTime?: () => number } | null>(null);
  const songTime = useRef(0);
  const lastTick = useRef(0);
  const [lyricOffset, setLyricOffset] = useState(0);
  const offsetRef = useRef(0);
  offsetRef.current = lyricOffset;
  const sungRef = useRef<Array<{ t: number; hz: number }>>([]);
  const [lineHold, setLineHold] = useState<number | null>(null);
  const tileCanvas = useRef<HTMLCanvasElement | null>(null);
  const arrangedRef = useRef<PopularSong | null>(null);
  arrangedRef.current = song ? { ...song, ...arrangeForLevel(song, level) } : null;

  const counts = useMemo(() => {
    const m = new Map<Genre, number>();
    for (const s of popularSongs) m.set(s.genre, (m.get(s.genre) ?? 0) + 1);
    return m;
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const diffRank = (d: PopularSong["difficulty"]) =>
      d === "Easy" ? 0 : d === "Medium" ? 1 : 2;
    return popularSongs
      .filter(
        (s) =>
          (genre === "All" || s.genre === genre) &&
          (q === "" ||
            s.title.toLowerCase().includes(q) ||
            s.artist.toLowerCase().includes(q))
      )
      .sort((a, b) => {
        if (sort === "easy") {
          return (
            diffRank(a.difficulty) - diffRank(b.difficulty) ||
            a.title.localeCompare(b.title)
          );
        }
        if (sort === "span") {
          return (
            a.vocalHighMidi - a.vocalLowMidi - (b.vocalHighMidi - b.vocalLowMidi) ||
            a.title.localeCompare(b.title)
          );
        }
        return a.title.localeCompare(b.title);
      });
  }, [query, genre, sort]);

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

    // Comfort-zone band for database songs (level arrangement)
    const s = arrangedRef.current;
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

  // Lyrics: user's upload wins; otherwise auto-fetch crowdsourced
  // synced lyrics once per song (cached). Silent on failure.
  async function ensureLyrics(
    s: PopularSong,
    cacheKey: string,
    current: LrcSong | null
  ) {
    if (current) {
      setLyricsState("ready");
      return;
    }
    setLyricsState("loading");
    const hit = cachedLrc(cacheKey);
    const apply = (text: string) => {
      try {
        setLrc(parseLrc(text));
        setLyricsState("ready");
      } catch {
        setLyricsState("missing");
      }
    };
    if (hit) {
      apply(hit);
      return;
    }
    const text = await fetchLrcText(s.artist, s.title);
    if (text) {
      cacheLrc(cacheKey, text);
      // Don't clobber an upload that landed while fetching.
      if (!lrcRef.current) apply(text);
      else setLyricsState("ready");
    } else {
      if (!lrcRef.current) setLyricsState("missing");
      else setLyricsState("ready");
    }
  }

  // YouTube player clock: drives lyric sync (and later, auto-finish).
  // Falls back to a local timer when the API isn't ready.
  useEffect(() => {
    if (phase !== "performing" && phase !== "scored") return;
    let cancelled = false;
    const w = window as typeof window & {
      YT?: {
        Player: new (
          el: HTMLIFrameElement,
          opts: { events?: { onReady?: (e: { target: unknown }) => void } }
        ) => { getCurrentTime?: () => number };
      };
      onYouTubeIframeAPIReady?: () => void;
    };
    const attach = () => {
      if (cancelled || !ytFrame.current || ytPlayer.current) return;
      try {
        ytPlayer.current = new w.YT!.Player(ytFrame.current, {});
      } catch {
        ytPlayer.current = null;
      }
    };
    if (w.YT?.Player) {
      attach();
      return () => {
        cancelled = true;
      };
    }
    const prev = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => {
      prev?.();
      attach();
    };
    const script = document.querySelector<HTMLScriptElement>(
      'script[src="https://www.youtube.com/iframe_api"]'
    );
    if (!script) {
      const el = document.createElement("script");
      el.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(el);
    }
    return () => {
      cancelled = true;
    };
  }, [phase, videoId, runId]);

  function detectLoop() {
    if (!analyser.current || !micContext.current) return;
    const paint = uiTick.current();
    const nowMs = performance.now();
    const dt = lastTick.current > 0 ? (nowMs - lastTick.current) / 1000 : 1 / 60;
    lastTick.current = nowMs;
    try {
      const t = ytPlayer.current?.getCurrentTime?.();
      if (typeof t === "number" && Number.isFinite(t)) songTime.current = t;
      else songTime.current += Math.min(dt, 0.25);
    } catch {
      songTime.current += Math.min(dt, 0.25);
    }
    const buffer = new Float32Array(analyser.current.fftSize);
    analyser.current.getFloatTimeDomainData(buffer);
    const detected = detectPitch(buffer, micContext.current.sampleRate);

    // allFrames keeps gaps (nulls) so the bleed monitor can tell a
    // breathing human from an unbroken track.
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
      frames.current.push(detected);
      recent.current.push(detected);
      if (recent.current.length > 8) recent.current.shift();
      const list = smoothFrequencies(recent.current, 5);
      const smoothed = list[list.length - 1] ?? detected;
      // Effective lyric time: player clock plus the user's per-song nudge.
      const tEff = songTime.current + offsetRef.current;
      if (paint) {
        setNote(midiToNote(69 + 12 * Math.log2(smoothed / 440)));
        sungRef.current.push({ t: tEff, hz: smoothed });
        if (sungRef.current.length > 3600) {
          sungRef.current.splice(0, sungRef.current.length - 3600);
        }
        if (lrcRef.current) {
          const now = activeLyric(lrcRef.current, tEff);
          setLyric(now);
          // Hold-the-phrase: % of this line sung inside the zone.
          const zone = arrangedRef.current;
          if (now && zone) {
            const lines = lrcRef.current.lines;
            const end =
              now.index + 1 < lines.length
                ? lines[now.index + 1].t
                : tEff + 0.01;
            const lo = 440 * Math.pow(2, (zone.tessituraLowMidi - 69) / 12);
            const hi = 440 * Math.pow(2, (zone.tessituraHighMidi - 69) / 12);
            const inLine = sungRef.current.filter(
              (s) => s.t >= lines[now.index].t && s.t < end
            );
            setLineHold(
              inLine.length === 0
                ? null
                : Math.round(
                    (100 * inLine.filter((s) => s.hz >= lo && s.hz <= hi).length) /
                      inLine.length
                  )
            );
          } else {
            setLineHold(null);
          }
        }
      }
      line.current.push(smoothed);
      if (line.current.length > 180) line.current.shift();
      draw();
    }

    drawTiles(songTime.current + offsetRef.current);
    animationFrame.current = requestAnimationFrame(detectLoop);
  }

  // Piano-tiles lane: word tiles fall to the hit line in time with the
  // lyrics. A tile flashes green when the voice is inside the zone as it
  // lands, amber when sung off-zone, grey when missed. Timing + control,
  // never a claim about the original's melody.
  function drawTiles(t: number) {
    const el = tileCanvas.current;
    const lrc = lrcRef.current;
    const zone = arrangedRef.current;
    if (!el || !lrc || !zone) return;
    const ctx = el.getContext("2d");
    if (!ctx) return;
    const W = (el.width = el.clientWidth * 2);
    const H = (el.height = 200);
    ctx.clearRect(0, 0, W, H);

    const lo = 440 * Math.pow(2, (zone.tessituraLowMidi - 69) / 12);
    const hi = 440 * Math.pow(2, (zone.tessituraHighMidi - 69) / 12);
    // 2s window falling to the hit line at the bottom.
    const yOf = (tt: number) => H - ((tt - t) / 2) * (H - 20) - 10;
    const hitY = yOf(t);

    ctx.fillStyle = "rgba(200,255,61,0.35)";
    ctx.fillRect(0, hitY - 2, W, 4);

    const lines = lrc.lines;
    let li = 0;
    while (li < lines.length - 1 && lines[li + 1].t <= t) li++;
    for (let k = Math.max(0, li - 1); k < Math.min(lines.length, li + 3); k++) {
      const nextStart = k + 1 < lines.length ? lines[k + 1].t : null;
      const words = wordTimings(lines[k], nextStart);
      const n = Math.max(1, words.length);
      words.forEach((w, i) => {
        if (w.t < t - 0.6 || w.t > t + 2) return;
        const tw = W / n;
        const x = i * tw + 6;
        const y = yOf(w.t) - 30;
        const landed = w.t <= t;
        let fill = "rgba(255,255,255,0.22)";
        if (landed) {
          const atHit = sungRef.current.filter(
            (s) => s.t >= w.t - 0.3 && s.t <= Math.min(t, w.t + 0.3)
          );
          if (atHit.length === 0) fill = "rgba(255,255,255,0.12)";
          else if (atHit.some((s) => s.hz >= lo && s.hz <= hi))
            fill = "#c8ff3d";
          else fill = "#ffc53d";
        }
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.roundRect(x, y, tw - 12, 56, 12);
        ctx.fill();
        ctx.fillStyle =
          fill === "#c8ff3d" ? "#000" : "rgba(255,255,255,0.85)";
        ctx.font = "bold 22px system-ui";
        ctx.textAlign = "center";
        ctx.fillText(w.word.slice(0, 10), x + (tw - 12) / 2, y + 36);
      });
    }
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
    setSong(s);
    setVideoId(vid);
    // Sound check first: the video plays and we verify the mic hears
    // the room, not the track. Performing on a bleeding mic just
    // traces the song and drowns the voice.
    setPhase("check");
  }

  async function startAfterCheck() {
    if (!(await startMic())) {
      setPhase("pick");
      return;
    }
    frames.current = [];
    recent.current = [];
    line.current = [];
    allFrames.current = [];
    setBleedWarn(false);
    setLyric(null);
    setLrc(null);
    setLineHold(null);
    sungRef.current = [];
    setLyricsState("idle");
    songTime.current = 0;
    lastTick.current = 0;
    setLyricOffset(
      loadOffset(localStorage, songRef.current?.id ?? null, videoId)
    );
    ytPlayer.current = null;
    setNote("—");
    setRunId((r) => r + 1); // restart the video from the top
    const current = songRef.current;
    if (current) {
      void ensureLyrics(current, current.id, null);
    }
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
      const arranged = arrangeForLevel(s, level);
      const r = scoreSongPerformance(frames.current, arranged);
      if (r) {
        view = {
          accuracy: r.accuracy,
          grade: r.grade,
          detail: `${level} arrangement · range hold ${r.rangeHold}% · vocal control ${r.steadiness}% across ${r.framesTotal} frames. Belts outside your zone still count when they're steady.`,
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
      level: s ? level : undefined,
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
          <Link
            href="/singalong"
            className="mx-auto mt-4 block max-w-xl rounded-2xl border border-[#c8ff3d]/25 bg-[#c8ff3d]/[0.05] p-4 text-sm leading-6 text-[#b8b8c0] transition hover:bg-[#c8ff3d]/[0.08]"
          >
            Want the full karaoke loop — backing track, lyrics and
            hit-the-word scoring?{" "}
            <span className="font-black text-[#c8ff3d]">
              Bring your own audio file →
            </span>
          </Link>

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

              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search title or artist…"
                className="mt-4 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-[#8a8a94] focus:border-[#c8ff3d]/60 focus:outline-none"
              />

              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {(["All", ...GENRES] as const).map((g) => {
                  const active = genre === g;
                  const n =
                    g === "All"
                      ? popularSongs.length
                      : (counts.get(g) ?? 0);
                  return (
                    <button
                      key={g}
                      onClick={() => setGenre(g)}
                      className={
                        active
                          ? "shrink-0 rounded-full bg-[#c8ff3d] px-4 py-2 text-xs font-black text-black"
                          : "shrink-0 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-xs font-bold text-[#b8b8c0] hover:bg-white/[0.08]"
                      }
                    >
                      {g} · {n}
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-[#8a8a94] tabular-nums">
                  {visible.length} of {popularSongs.length} tracks
                </span>
                <label className="flex items-center gap-2 text-xs text-[#8a8a94]">
                  Sort
                  <select
                    value={sort}
                    onChange={(e) =>
                      setSort(e.target.value as "az" | "easy" | "span")
                    }
                    className="rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-white focus:border-[#c8ff3d]/60 focus:outline-none"
                  >
                    <option value="az">A–Z</option>
                    <option value="easy">Easiest first</option>
                    <option value="span">Narrowest range</option>
                  </select>
                </label>
              </div>

              {visible.length === 0 && (
                <p className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center text-sm text-[#b8b8c0]">
                  No tracks match “{query.trim()}”. Try another title or
                  artist — or paste any YouTube link above.
                </p>
              )}

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {visible.map((s) => (
                  <div
                    key={s.id}
                    className="rounded-3xl border border-white/10 bg-white/[0.03] p-5"
                  >
                    <div className="text-lg font-black">{s.title}</div>
                    <div className="mt-0.5 text-sm text-[#b8b8c0]">
                      {s.artist}
                    </div>
                    <div className="mt-2 text-xs text-[#8a8a94]">
                      {s.genre} · Key {s.key} · {s.rangeEstimate ? "~" : ""}
                      {midiToNote(s.vocalLowMidi)}–
                      {midiToNote(s.vocalHighMidi)} · {s.difficulty}
                    </div>
                    <div className="mt-4 flex gap-2">
                      {s.videoId ? (
                        <button
                          onClick={() => beginSong(s, s.videoId as string)}
                          className="flex-1 rounded-xl bg-[#c8ff3d] px-4 py-2.5 text-sm font-black text-black transition hover:-translate-y-0.5"
                        >
                          Sing →
                        </button>
                      ) : (
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
                      )}
                    </div>
                    {!s.videoId && (
                      <p className="mt-2 text-[11px] leading-5 text-[#8a8a94]">
                        Open the video, copy its link, paste it above — the
                        track then plays here with live scoring.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {phase === "check" && (
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
                  key={`${videoId}-check`}
                  src={`${embedUrl(videoId)}&autoplay=1`}
                  title="Song playback"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="h-full w-full"
                />
              </div>
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
              {phase === "performing" && (
                <div className="mt-4 flex justify-center">
                  <LevelPicker level={level} onChange={setLevel} />
                </div>
              )}
              <div className="mx-auto mt-4 aspect-video w-full max-w-2xl overflow-hidden rounded-3xl border border-white/10 bg-black">
                <iframe
                  ref={ytFrame}
                  key={`${videoId}-${runId}`}
                  src={`${embedUrl(videoId)}&autoplay=${phase === "performing" ? 1 : 0}`}
                  title="Song playback"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="h-full w-full"
                />
              </div>
              <div className="mx-auto mt-3 max-w-md">
                <LyricsField
                  lrc={lrc}
                  onLoad={(songLrc) => {
                    setLrc(songLrc);
                    setLyricsState("ready");
                  }}
                  onError={setError}
                />
                {lyricsState === "loading" && (
                  <p className="mt-2 text-xs text-[#8a8a94]">
                    Looking up synced lyrics…
                  </p>
                )}
                {lyricsState === "missing" && !lrc && (
                  <p className="mt-2 text-xs text-[#8a8a94]">
                    No synced lyrics found for this one — drop in your
                    own .lrc above.
                  </p>
                )}
              </div>
              {lyric && phase === "performing" && (
                <div className="mx-auto mt-3 max-w-2xl text-center">
                  <div className="text-2xl font-black tracking-tight">
                    {lyric.text}
                  </div>
                  {lyric.next && (
                    <div className="mt-1.5 text-sm font-bold text-[#8a8a94]">
                      {lyric.next}
                    </div>
                  )}
                  {lineHold !== null && (
                    <div className="mx-auto mt-3 max-w-xs">
                      <div className="h-2 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-[#c8ff3d] transition-all"
                          style={{ width: `${lineHold}%` }}
                        />
                      </div>
                      <p className="mt-1 text-[11px] font-bold text-[#8a8a94] tabular-nums">
                        Holding the phrase: {lineHold}%
                      </p>
                    </div>
                  )}
                  {lrc && phase === "performing" && (
                    <>
                      <canvas
                        ref={tileCanvas}
                        className="mx-auto mt-4 h-24 w-full max-w-2xl rounded-3xl border border-white/10 bg-black/40"
                      />
                      <div className="mx-auto mt-2 flex max-w-2xl items-center justify-between gap-3">
                        <p className="text-[11px] text-[#8a8a94]">
                          Tiles fall in time with the words — sing in your
                          zone as each one lands
                        </p>
                        <div
                          role="group"
                          aria-label="Lyric sync"
                          className="flex shrink-0 items-center gap-1.5"
                        >
                          <button
                            onClick={() =>
                              setLyricOffset((o) => {
                                const v = stepOffset(o, -1);
                                try {
                                  localStorage.setItem(currentOffsetKey(), String(v));
                                } catch {
                                  // ignore
                                }
                                return v;
                              })
                            }
                            aria-label="Lyrics earlier"
                            className="rounded-full border border-white/10 px-2.5 py-1 text-xs font-black text-[#b8b8c0] hover:text-white"
                          >
                            −
                          </button>
                          <span className="min-w-10 text-center text-[11px] font-bold text-[#8a8a94] tabular-nums">
                            {lyricOffset > 0 ? "+" : ""}
                            {lyricOffset.toFixed(1)}s
                          </span>
                          <button
                            onClick={() =>
                              setLyricOffset((o) => {
                                const v = stepOffset(o, 1);
                                try {
                                  localStorage.setItem(currentOffsetKey(), String(v));
                                } catch {
                                  // ignore
                                }
                                return v;
                              })
                            }
                            aria-label="Lyrics later"
                            className="rounded-full border border-white/10 px-2.5 py-1 text-xs font-black text-[#b8b8c0] hover:text-white"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              <div className="mt-6 text-6xl font-black tracking-[-0.06em]">
                {note}
              </div>

              {bleedWarn && (
                <div className="mx-auto mt-4 max-w-md rounded-2xl border border-[#ffc53d]/30 bg-[#ffc53d]/[0.06] p-4 text-left">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-xs leading-5 text-[#ffd98a]">
                      This looks like the track, not you — continuous and
                      breathless. Plug in earbuds if you haven&apos;t; your
                      score only counts when the mic hears your voice.
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
                      shaded band = your {level} zone (
                      {midiToNote(arrangeForLevel(song, level).tessituraLowMidi)}–
                      {midiToNote(arrangeForLevel(song, level).tessituraHighMidi)}) — the song will
                      take you outside it, that&apos;s normal
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
