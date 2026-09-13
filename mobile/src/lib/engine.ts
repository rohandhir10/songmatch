// Pitch engine: textbook YIN (pitchfinder, pure JS, zero native deps)
// behind the same sync call signature the pages already use, with the
// battle-tested autocorrelator as fallback. Detectors are cheap to build
// and stateless, so one is cached per sample rate. No async init, no
// WASM, no bundle risk — it runs identically on web, Metro and Node.
import { YIN } from "pitchfinder";
import { detectPitch } from "./pitch.ts";

type Detector = (frame: Float32Array) => number | null;

const detectors = new Map<number, Detector>();

function ensure(sampleRate: number): Detector | null {
  const hit = detectors.get(sampleRate);
  if (hit) return hit;
  try {
    const detect = YIN({ sampleRate }) as Detector;
    detectors.set(sampleRate, detect);
    return detect;
  } catch {
    return null;
  }
}

// Call once when the mic opens so the first frame is already fast.
// Safe to call repeatedly; never throws.
export function warmEngine(sampleRate: number): void {
  try {
    ensure(sampleRate);
  } catch {
    // Autocorrelator carries every page.
  }
}

// Sync per-frame detect. Same contract as detectPitch: NaN when unvoiced.
export function detectEngine(
  frame: Float32Array,
  sampleRate: number
): number {
  const detect = ensure(sampleRate);
  if (detect) {
    try {
      const f = detect(frame);
      if (typeof f === "number" && Number.isFinite(f) && f >= 70 && f <= 1200) {
        return f;
      }
    } catch {
      // Fall through to the autocorrelator.
    }
  }
  return detectPitch(frame, sampleRate);
}

export function engineReady(sampleRate: number): boolean {
  return detectors.has(sampleRate);
}
