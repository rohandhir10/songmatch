export type VocalProfile = {
  minFrequency: number;
  maxFrequency: number;
  centerFrequency: number;

  minMidi: number;
  maxMidi: number;

  lowNote: string;
  highNote: string;

  voiceType: string;

  // Voice weight ("Deep & dark" / "Warm" / "Light & bright") — same range,
  // different instrument. Measured in the scan, absent on older profiles.
  weight?: string;

  sampleCount: number;

  // Comfortable usable range: frames that are confident AND sustained.
  // These are the notes the voice can really live in. "touchedLow/High"
  // are the outer edges the voice brushed but didn't settle in.
  comfortableLowMidi: number;
  comfortableHighMidi: number;
  comfortableLowNote: string;
  comfortableHighNote: string;

  // Tessitura: where the voice clusters (weighted median band). This is
  // where the voice spends its time and sounds most natural — not the
  // trimmed 20% heuristic.
  tessituraCenterMidi: number;
  tessituraLowMidi: number;
  tessituraHighMidi: number;

  // Consistency: how steady the voice is across the comfortable zone.
  // 0..100. High = controlled (good for belting/hits), low = slides/wanders.
  consistency: number;

  // How much of the scan was actually usable signal (not noise, not bleed).
  // Low values mean the profile should be taken with salt.
  signalRatio: number;

  // Breathy vs pressed: spectral spread of voiced frames. Rough texture cue.
  breathiness: number;

  // Whether the scan covered a real sweep or just sat in one spot.
  wasSwept: boolean;
};

const NOTE_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];

export function frequencyToMidi(frequency: number): number {
  return 69 + 12 * Math.log2(frequency / 440);
}

export function midiToFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function midiToNote(midi: number): string {
  const rounded = Math.round(midi);

  const noteIndex = ((rounded % 12) + 12) % 12;
  const octave = Math.floor(rounded / 12) - 1;

  return `${NOTE_NAMES[noteIndex]}${octave}`;
}

// Cents deviation from the nearest semitone: +50 = quarter-sharp,
// -30 = thirty cents flat. Drives the live in-tune needle.
export function centsOffNearest(frequency: number): number {
  const midiFloat = 69 + 12 * Math.log2(frequency / 440);
  return Math.round((midiFloat - Math.round(midiFloat)) * 100);
}

// % of frames sung within ±35 cents of their chunk median — i.e. how
// steadily the voice holds pitch vs sliding around. Frames are grouped
// into ~0.5s chunks (30 frames at 60fps): vibrato oscillates around the
// chunk median (steady) while slides move through it (unsteady). A
// centered sliding window can't see slides — its median always equals
// the local value on linear data.
// Phrase-score input until melody timelines exist for true target-note
// scoring.
export function pitchSteadiness(frequencies: number[]): number | null {
  const frames = frequencies.filter(
    (f) => Number.isFinite(f) && f > 0
  );
  if (frames.length < 3) return null;

  const CHUNK = 30;
  let steady = 0;
  for (let start = 0; start < frames.length; start += CHUNK) {
    let end = Math.min(start + CHUNK, frames.length);
    if (frames.length - end < 8 && end < frames.length) {
      end = frames.length; // fold a tiny tail into the last full chunk
    }
    const chunk = [...frames.slice(start, end)].sort((a, b) => a - b);
    const median = chunk[Math.floor(chunk.length / 2)];
    for (let i = start; i < end; i++) {
      if (Math.abs(1200 * Math.log2(frames[i] / median)) <= 35) steady += 1;
    }
    if (end === frames.length) break;
  }
  return Math.round((steady / frames.length) * 100);
}

// Latency budget of the live loops (mic → screen), measured reasoning:
// capture ~0ms (AnalyserNode reads already-buffered audio) + YIN ~1-3ms
// (2048-sample window × ~500 taus in JS) + canvas draw ~1ms. The dominant
// term was React: setState on note/frequency/cents re-rendered 60×/s.
// frameGate throttles those commits (~15Hz) while detection, recording
// and canvas stay per-frame — perceived latency drops to ~window (43ms)
// + smoothing (~60ms) with no render jank. rAF still throttles in
// background tabs; that pauses the loop rather than drifting it.
export function frameGate(everyNth: number): () => boolean {
  const n = Math.max(1, Math.floor(everyNth));
  let i = 0;
  return () => i++ % n === 0;
}

// Trailing median over live pitch frames. The raw per-frame readout jumps on
// vibrato and single-frame octave pops, which reads as "inaccurate" even when
// the underlying detector is right — the display should show the stable pitch.
export function smoothFrequencies(
  frames: number[],
  windowSize = 5
): number[] {
  if (frames.length === 0) return [];
  const size = Math.max(1, Math.floor(windowSize));
  const out: number[] = [];
  for (let i = 0; i < frames.length; i++) {
    const start = Math.max(0, i - size + 1);
    const window = [...frames.slice(start, i + 1)].sort((a, b) => a - b);
    out.push(window[Math.floor(window.length / 2)]);
  }
  return out;
}

export function detectPitch(
  buffer: Float32Array,
  sampleRate: number
): number {
  const size = buffer.length;

  let rms = 0;

  for (let i = 0; i < size; i++) {
    const sample = buffer[i];
    rms += sample * sample;
  }

  rms = Math.sqrt(rms / size);

  if (rms < 0.015) {
    return -1;
  }

  // YIN-style detector (de Cheveigné/Kawahara): difference function with
  // cumulative-mean normalization, then first dip below threshold.
  // The previous global-max correlation picked whichever multiple of the
  // true period happened to align with the window phase (same 220Hz tone
  // read 44–220Hz; normalized max still octave-jumped 220→110, 440→49).
  // First-dip picking locks the fundamental instead of its multiples.
  const minTau = Math.max(20, Math.floor(sampleRate / 600));
  const maxTau = Math.min(Math.floor(size / 2) - 1, Math.ceil(sampleRate / 70));
  if (maxTau <= minTau) return -1;

  const range = maxTau - minTau + 1;
  const diff = new Float32Array(range);
  for (let t = 0; t < range; t++) {
    const tau = minTau + t;
    let d = 0;
    for (let i = 0; i + tau < size; i++) {
      const delta = buffer[i] - buffer[i + tau];
      d += delta * delta;
    }
    diff[t] = d;
  }

  // Cumulative mean normalized difference
  let runningSum = 0;
  const cmn = new Float32Array(range);
  for (let t = 0; t < range; t++) {
    runningSum += diff[t];
    cmn[t] = runningSum > 1e-12 ? (diff[t] * (t + 1)) / runningSum : 1;
  }

  const threshold = 0.15;
  let tauIndex = -1;
  for (let t = 0; t < range; t++) {
    if (cmn[t] < threshold) {
      // Walk to the local minimum past this dip for stability
      while (t + 1 < range && cmn[t + 1] < cmn[t]) t++;
      tauIndex = t;
      break;
    }
  }
  if (tauIndex === -1) {
    // No confident dip — fall back to global minimum if reasonably deep
    let best = 0;
    for (let t = 1; t < range; t++) if (cmn[t] < cmn[best]) best = t;
    if (cmn[best] > 0.5) return -1;
    tauIndex = best;
  }

  // Parabolic interpolation around the dip for sub-sample accuracy
  let tau = minTau + tauIndex;
  if (tauIndex > 0 && tauIndex < range - 1) {
    const a = cmn[tauIndex - 1];
    const b = cmn[tauIndex];
    const c = cmn[tauIndex + 1];
    const denom = a - 2 * b + c;
    if (Math.abs(denom) > 1e-9) {
      tau += ((a - c) / (2 * denom)) * 0.5;
    }
  }

  if (!Number.isFinite(tau) || tau <= 0) return -1;

  return sampleRate / tau;
}

export function cleanSamples(
  frequencies: number[]
): number[] {
  const valid = frequencies.filter(
    (frequency) =>
      Number.isFinite(frequency) &&
      frequency >= 70 &&
      frequency <= 600
  );

  if (valid.length < 3) {
    return [];
  }

  const sorted = [...valid].sort((a, b) => a - b);

  const lowIndex = Math.floor(sorted.length * 0.05);
  const highIndex = Math.floor(sorted.length * 0.95);

  return sorted.slice(
    lowIndex,
    Math.max(lowIndex + 1, highIndex + 1)
  );
}

function classifyVoice(
  centerFrequency: number,
  minMidi: number,
  maxMidi: number
): string {
  void minMidi;
  void maxMidi;
  // Full ladder on the sung center — the old bands topped out at a
  // catch-all "Higher Voice", so altos, mezzos and sopranos all got the
  // same unhelpful label.
  const centerMidi = frequencyToMidi(centerFrequency);

  if (centerMidi < 47) return "Bass";
  if (centerMidi < 52) return "Baritone";
  if (centerMidi < 57) return "Tenor";
  if (centerMidi < 62) return "Alto";
  if (centerMidi < 67) return "Mezzo-Soprano";
  return "Soprano";
}

export function buildVocalProfile(
  frequencies: number[],
  weightLabel?: string
): VocalProfile | null {
  const samples = cleanSamples(frequencies);

  if (samples.length < 3) {
    return null;
  }

  const minFrequency = samples[0];
  const maxFrequency = samples[samples.length - 1];

  const centerFrequency =
    samples.reduce((sum, value) => sum + value, 0) /
    samples.length;

  const minMidi = frequencyToMidi(minFrequency);
  const maxMidi = frequencyToMidi(maxFrequency);

  // Derive tessitura + comfortable band from the same samples; the new
  // matching layer expects those fields. For the old 5%/95% trimmed set,
  // treat the middle 50% as the "comfortable" range and the middle of that
  // as the tessitura center, with a ~35% span around it — same heuristic
  // the web layer uses when no sweep data is available.
  const sorted = [...samples].sort((a, b) => a - b);
  const n = sorted.length;
  const lo = sorted[Math.floor(n * 0.25)];
  const hi = sorted[Math.floor(n * 0.75)];
  const comfortableLowMidi = frequencyToMidi(lo);
  const comfortableHighMidi = frequencyToMidi(hi);
  const tessituraCenterMidi = (comfortableLowMidi + comfortableHighMidi) / 2;
  const tessituraSpan = Math.max(2, (comfortableHighMidi - comfortableLowMidi) * 0.35);
  const tessituraLowMidi = tessituraCenterMidi - tessituraSpan / 2;
  const tessituraHighMidi = tessituraCenterMidi + tessituraSpan / 2;

  return {
    minFrequency,
    maxFrequency,
    centerFrequency,

    minMidi,
    maxMidi,

    lowNote: midiToNote(minMidi),
    highNote: midiToNote(maxMidi),

    voiceType: classifyVoice(
      centerFrequency,
      minMidi,
      maxMidi
    ),

    sampleCount: samples.length,

    // Voice weight travels with the profile when provided: the scan
    // measures brightness, the profile carries the plain-words label.
    ...(weightLabel ? { weight: weightLabel } : {}),

    comfortableLowMidi,
    comfortableHighMidi,
    comfortableLowNote: midiToNote(comfortableLowMidi),
    comfortableHighNote: midiToNote(comfortableHighMidi),

    tessituraCenterMidi,
    tessituraLowMidi,
    tessituraHighMidi,

    consistency: 80,
    signalRatio: 80,
    breathiness: 50,
    wasSwept: false,
  };
}
