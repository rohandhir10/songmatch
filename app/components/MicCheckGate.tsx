"use client";

import { useEffect, useRef, useState } from "react";

import { analyzeSilence } from "@/lib/miccheck";
import { detectPitch } from "@/lib/pitch";

// Setup gate: while the track plays through speakers, the user stays
// silent for a few seconds. If the mic keeps hearing confident pitch,
// that's the track bleeding in — performing now would just trace the
// song and drown the voice. Block with guidance instead of a warning
// nobody reads.
export default function MicCheckGate({
  seconds = 4,
  onPass,
}: {
  seconds?: number;
  onPass: () => void;
}) {
  const [progress, setProgress] = useState(0);
  const [failed, setFailed] = useState(false);
  const [ratio, setRatio] = useState(0);
  const [round, setRound] = useState(0);

  const context = useRef<AudioContext | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const frame = useRef<number | null>(null);
  const frames = useRef<Array<number | null>>([]);
  const startedAt = useRef(0);
  const done = useRef(false);

  function cleanup() {
    if (frame.current !== null) {
      cancelAnimationFrame(frame.current);
      frame.current = null;
    }
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    context.current?.close();
    context.current = null;
  }

  function loop() {
    if (!analyser.current || !context.current) return;
    const elapsed = (performance.now() - startedAt.current) / 1000;
    setProgress(Math.min(1, elapsed / seconds));

    const buffer = new Float32Array(analyser.current.fftSize);
    analyser.current.getFloatTimeDomainData(buffer);
    const detected = detectPitch(buffer, context.current.sampleRate);
    frames.current.push(
      detected >= 70 && detected <= 800 ? detected : null
    );

    if (elapsed >= seconds && !done.current) {
      done.current = true;
      const verdict = analyzeSilence(frames.current);
      cleanup();
      if (verdict.bleed) {
        setRatio(verdict.voicedRatio);
        setFailed(true);
      } else {
        onPass();
      }
      return;
    }
    frame.current = requestAnimationFrame(loop);
  }

  async function run() {
    cleanup();
    done.current = false;
    frames.current = [];
    setFailed(false);
    setProgress(0);
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
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
      const ctx = new AudioContextClass();
      context.current = ctx;
      const source = ctx.createMediaStreamSource(media);
      const node = ctx.createAnalyser();
      node.fftSize = 2048;
      source.connect(node);
      analyser.current = node;
      startedAt.current = performance.now();
      loop();
    } catch {
      setFailed(true);
      setRatio(-1); // -1 = mic blocked, distinct from bleed
    }
  }

  useEffect(() => {
    run();
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round]);

  if (failed) {
    return (
      <div className="rounded-3xl border border-[#ffc53d]/30 bg-[#ffc53d]/[0.06] p-8 text-center">
        <div className="text-lg font-black">
          {ratio === -1 ? "Mic blocked" : "We hear the track, not you"}
        </div>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#b8b8c0]">
          {ratio === -1 ? (
            <>
              Allow microphone permission, then try again.
            </>
          ) : (
            <>
              Your mic is picking up the song from your speakers
              ({Math.round(ratio * 100)}% of the silence had pitch). Plug in
              earbuds so the mic hears only your voice, then retry — this
              check keeps your scores honest.
            </>
          )}
        </p>
        <button
          onClick={() => setRound((r) => r + 1)}
          className="mt-6 rounded-2xl bg-[#c8ff3d] px-8 py-3.5 font-black text-black"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center">
      <div className="text-sm font-black tracking-[0.2em] text-[#c8ff3d]">
        SOUND CHECK
      </div>
      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#b8b8c0]">
        The track is playing — stay completely silent. We&apos;re making
        sure the mic hears the room, not the song.
      </p>
      <div className="mx-auto mt-6 h-2 max-w-xs overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-[#c8ff3d] transition-[width]"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>
    </div>
  );
}
