// Pitch engine: Aubio's yinfft behind the same sync call signature the
// pages already use, with the battle-tested autocorrelator as fallback.
// fireAndForget warmup at mic start (async WASM init); detect() stays
// sync per frame and uses whichever engine is ready. No page ever blocks
// on WASM, and no page ever loses pitch if WASM fails.
import { detectPitch } from "./pitch";

type AubioPitch = {
  do(buffer: Float32Array): number;
};

const instances = new Map<number, AubioPitch>();
let warming: Promise<void> | null = null;

async function ensure(sampleRate: number): Promise<void> {
  if (instances.has(sampleRate)) return;
  if (!warming) {
    warming = (async () => {
      try {
        const mod = await import("aubiojs");
        const factory = mod.default ?? mod;
        const A = await factory();
        for (const sr of [44100, 48000, 22050, 16000, 96000]) {
          try {
            instances.set(sr, new A.Pitch("yinfft", 2048, 512, sr));
          } catch {
            // One bad rate never blocks the others.
          }
        }
      } catch {
        // WASM unavailable: autocorrelator carries every page.
      } finally {
        warming = null;
      }
    })();
  }
  await warming;
}

// Call once when the mic opens; never awaited by the loop.
export function warmEngine(sampleRate: number): void {
  void ensure(sampleRate);
}

// Sync per-frame detect. Same contract as detectPitch: NaN when unvoiced.
export function detectEngine(
  frame: Float32Array,
  sampleRate: number
): number {
  const inst = instances.get(sampleRate);
  if (inst) {
    try {
      const f = inst.do(frame);
      if (Number.isFinite(f) && f >= 70 && f <= 1200) return f;
    } catch {
      // Fall through to the autocorrelator.
    }
  }
  return detectPitch(frame, sampleRate);
}

export function engineReady(sampleRate: number): boolean {
  return instances.has(sampleRate);
}
