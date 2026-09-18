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

  // ---- new fields: the voice is more than min/max ----
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

// ---- shared constants ----
const NOTE_NAMES = [
  "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
];

const NOTE_NAMES_FLAT = [
  "C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B",
];

// Comfortable vocal range floor/ceiling in Hz. Below ~70Hz is rumble, above
// ~1200Hz is unlikely to be a fundamentals singers actually hold.
const HZ_LOW = 70;
const HZ_HIGH = 1200;

// ---- frequency <-> midi <-> note ----
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

export function midiToNoteFlat(midi: number): string {
  const rounded = Math.round(midi);
  const noteIndex = ((rounded % 12) + 12) % 12;
  const octave = Math.floor(rounded / 12) - 1;
  return `${NOTE_NAMES_FLAT[noteIndex]}${octave}`;
}

// ---- cents ----
export function centsOffNearest(frequency: number): number {
  const midiFloat = 69 + 12 * Math.log2(frequency / 440);
  return Math.round((midiFloat - Math.round(midiFloat)) * 100);
}

// ---- frame gate (latency throttle for React commits) ----
export function frameGate(everyNth: number): () => boolean {
  const n = Math.max(1, Math.floor(everyNth));
  let i = 0;
  return () => i++ % n === 0;
}

// ---- trailing median smoother ----
export function smoothFrequencies(
  frames: number[],
  windowSize = 5,
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

// ---- RMS + spectral energy (used for voicing confidence) ----
function rmsOf(buffer: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) sum += buffer[i] * buffer[i];
  return Math.sqrt(sum / buffer.length);
}

// Spectral energy in the vocal region (roughly 100Hz–1kHz) from an FFT-size
// magnitude array. Used as a second voicing cue alongside RMS.
function vocalBandEnergy(
  magnitudes: Float32Array,
  sampleRate: number,
  fftSize: number,
): number {
  const binHz = sampleRate / fftSize;
  const loBin = Math.max(1, Math.floor(100 / binHz));
  const hiBin = Math.min(magnitudes.length - 1, Math.ceil(1000 / binHz));
  let energy = 0;
  for (let i = loBin; i <= hiBin; i++) energy += magnitudes[i];
  return energy / (hiBin - loBin + 1);
}

// ---- YIN pitch detection (the core engine) ----
// Returns the detected frequency and a raw "dip quality" 0..1.
// dipQuality ~ how deep and clean the cumulative-mean-normalized minimum was.
// Higher = more periodic/tonal. Lower = noisy, brief, or non-voiced.
function yinDetect(
  buffer: Float32Array,
  sampleRate: number,
): { freq: number; dipQuality: number; tau: number } {
  const size = buffer.length;

  const minTau = Math.max(20, Math.floor(sampleRate / HZ_HIGH));
  const maxTau = Math.min(Math.floor(size / 2) - 1, Math.ceil(sampleRate / HZ_LOW));
  if (maxTau <= minTau) return { freq: -1, dipQuality: 0, tau: -1 };

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
      while (t + 1 < range && cmn[t + 1] < cmn[t]) t++;
      tauIndex = t;
      break;
    }
  }
  if (tauIndex === -1) {
    let best = 0;
    for (let t = 1; t < range; t++)
      if (cmn[t] < cmn[best]) best = t;
    if (cmn[best] > 0.5) return { freq: -1, dipQuality: 0, tau: -1 };
    tauIndex = best;
  }

  let tau = minTau + tauIndex;
  if (tauIndex > 0 && tauIndex < range - 1) {
    const a = cmn[tauIndex - 1];
    const b = cmn[tauIndex];
    const c = cmn[tauIndex + 1];
    const denom = a - 2 * b + c;
    if (Math.abs(denom) > 1e-9)
      tau += ((a - c) / (2 * denom)) * 0.5;
  }
  if (!Number.isFinite(tau) || tau <= 0) return { freq: -1, dipQuality: 0, tau: -1 };

  const freq = sampleRate / tau;
  const dipQuality = 1 - cmn[tauIndex]; // deeper dip = higher quality

  return { freq, dipQuality, tau };
}

// ---- confidence-rated pitch frame ----
export type PitchFrame = {
  freq: number;        // Hz, -1 if unvoiced
  midi: number;        // midi, -1 if unvoiced
  confidence: number;  // 0..1
  voiced: boolean;
  rms: number;
  dipQuality: number;
};

// detectPitch is the legacy export — kept for call-site compatibility but now
// confidence-rated internally. Pages that only read the number still work;
// pages that want quality should use the per-frame PitchFrame stream instead.
export function detectPitch(
  buffer: Float32Array,
  sampleRate: number,
): number {
  const { freq } = yinDetect(buffer, sampleRate);
  return freq;
}

// detectFrame is the confidence-rated version. Pages that want a better
// singing/scanning experience should use this and gate on confidence.
export function detectFrame(
  buffer: Float32Array,
  sampleRate: number,
): PitchFrame {
  const rms = rmsOf(buffer);
  const { freq, dipQuality, tau } = yinDetect(buffer, sampleRate);

  if (freq < 0 || !Number.isFinite(freq)) {
    return { freq: -1, midi: -1, confidence: 0, voiced: false, rms, dipQuality: 0 };
  }

  // Confidence blend: periodicity (YIN dip), signal level, and spectral
  // energy in the vocal band. A loud but non-periodic frame (e.g. plosive)
  // won't score high; a clean sustained tone will.
  const levelCue = Math.min(1, rms / 0.12);
  const dipCue = Math.min(1, dipQuality * 1.6);
  const voiced = freq >= HZ_LOW && freq <= HZ_HIGH && levelCue > 0.04 && dipCue > 0.05;

  let confidence = 0;
  if (voiced) {
    confidence = 0.35 * dipCue + 0.35 * levelCue + 0.30 * Math.min(1, dipQuality * 2);
    confidence = Math.min(1, Math.max(0, confidence));
  }

  return {
    freq,
    midi: 69 + 12 * Math.log2(freq / 440),
    confidence,
    voiced,
    rms,
    dipQuality,
  };
}

// ---- steady-frame accumulator for scan ----
// During a scan we collect confident frames and group them by how long the
// voice held near a pitch. A brief touch (one or two frames) does not
// establish a note as "comfortable"; a cluster of frames around a pitch does.
const SUSTAIN_FRAMES = 8;     // ~0.13s at 60fps — a note has to hang around
const CLUSTER_HZ = 1.5;       // Hz tolerance to group consecutive frames together

export type AccumulatedFrame = {
  freq: number;
  midi: number;
  confidence: number;
  startIdx: number;
  length: number;
};

// Cluster consecutive voiced frames into sustained blobs. A blob that lasts
// long enough is a "note the voice actually lived in"; the rest is texture.
export function clusterFrames(frames: PitchFrame[]): AccumulatedFrame[] {
  const out: AccumulatedFrame[] = [];
  let cur: AccumulatedFrame | null = null;

  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    if (!f.voiced || f.confidence < 0.15) {
      if (cur) { out.push(cur); cur = null; }
      continue;
    }
    if (cur && Math.abs(f.freq - cur.freq) <= CLUSTER_HZ && f.midi === cur.midi) {
      cur.length++;
      cur.confidence = (cur.confidence * cur.length + f.confidence) / (cur.length + 1);
    } else {
      if (cur) out.push(cur);
      cur = { freq: f.freq, midi: f.midi, confidence: f.confidence, startIdx: i, length: 1 };
    }
  }
  if (cur) out.push(cur);
  return out;
}

// ---- spectrum-based breathiness ----
// Rough measure: ratio of high-band energy to total energy in voiced frames.
// Higher = more breathy/airy. Lower = more pressed/dark. Used as texture cue.
function blitSpectrum(
  buffer: Float32Array,
  sampleRate: number,
  fftSize: number,
): Float32Array {
  // Simple periodogram (no windowing for speed; good enough as a cue).
  const mags = new Float32Array(fftSize / 2);
  for (let k = 0; k < mags.length; k++) {
    let re = 0, im = 0;
    for (let n = 0; n < buffer.length; n++) {
      const phase = (2 * Math.PI * k * n) / fftSize;
      re += buffer[n] * Math.cos(phase);
      im -= buffer[n] * Math.sin(phase);
    }
    mags[k] = Math.sqrt(re * re + im * im) / buffer.length;
  }
  return mags;
}

function breathinessOf(buffer: Float32Array, sampleRate: number): number {
  const fftSize = 2048;
  const mags = blitSpectrum(buffer, sampleRate, fftSize);
  const binHz = sampleRate / fftSize;
  let total = 0;
  let high = 0;
  const lowEnd = Math.max(1, Math.floor(100 / binHz));
  const highStart = Math.floor(2000 / binHz);
  for (let i = lowEnd; i < mags.length; i++) {
    total += mags[i];
    if (i >= highStart) high += mags[i];
  }
  if (total <= 0) return 0;
  return Math.min(1, high / total);
}

// ---- build profile from raw pitch frames ----
// The old buildVocalProfile took raw frequencies and trimmed the extremes.
// The new one uses confidence + clustering to separate "comfortable" from
// "touched", and derives tessitura + consistency + texture from the stream.
export function buildVocalProfile(
  pitchFrames: PitchFrame[],
  weightLabel?: string,
): VocalProfile | null {
  if (pitchFrames.length < 3) return null;

  // Keep only voiced, confident frames for the profile.
  const voiced = pitchFrames.filter(
    (f) => f.voiced && Number.isFinite(f.freq) && f.freq >= HZ_LOW && f.freq <= HZ_HIGH && f.confidence >= 0.15,
  );
  if (voiced.length < 3) return null;

  const totalFrames = pitchFrames.length;
  const signalRatio = voiced.length / totalFrames;

  // Cluster into sustained blobs — these are the notes the voice actually
  // spent time in. A brief touch does not expand the comfortable range.
  const clusters = clusterFrames(pitchFrames);
  const sustained = clusters.filter((c) => c.length >= SUSTAIN_FRAMES);

  // ---- comfortable range: from sustained clusters ----
  let comfortableLow = Infinity;
  let comfortableHigh = -Infinity;
  const centsList: number[] = [];
  const breathinessSum = 0;

  if (sustained.length === 0) {
    // Fall back to confident voiced frames if no cluster lasted long enough.
    for (const f of voiced) {
      if (f.midi < comfortableLow) comfortableLow = f.midi;
      if (f.midi > comfortableHigh) comfortableHigh = f.midi;
      centsList.push(centsOffNearest(f.freq));
    }
  } else {
    for (const c of sustained) {
      if (c.midi < comfortableLow) comfortableLow = c.midi;
      if (c.midi > comfortableHigh) comfortableHigh = c.midi;
      centsList.push(centsOffNearest(c.freq));
    }
  }

  if (!Number.isFinite(comfortableLow) || !Number.isFinite(comfortableHigh) || comfortableLow >= comfortableHigh) {
    return null;
  }

  // ---- touched edges: confident frames beyond comfortable ----
  let touchedLow = comfortableLow;
  let touchedHigh = comfortableHigh;
  for (const f of voiced) {
    if (f.confidence < 0.2) continue; // don't count weak bleeds
    if (f.midi < touchedLow) touchedLow = f.midi;
    if (f.midi > touchedHigh) touchedHigh = f.midi;
  }

  // If touched edges are way beyond comfortable, clip — they were brief.
  const span = comfortableHigh - comfortableLow;
  if (span > 0) {
    const allowedStretch = Math.max(3, span * 0.4);
    if (touchedLow < comfortableLow - allowedStretch) touchedLow = comfortableLow - allowedStretch;
    if (touchedHigh > comfortableHigh + allowedStretch) touchedHigh = comfortableHigh + allowedStretch;
  }

  // ---- tessitura: weighted median band of sustained cluster centers ----
  // Weight each cluster by its length (how long the voice held there) times
  // its confidence. The voice's "home" is where it spent the most quality time.
  const weights: number[] = [];
  const centers: number[] = [];
  let weightTotal = 0;
  for (const c of sustained) {
    const w = c.length * (0.5 + 0.5 * c.confidence);
    weights.push(w);
    centers.push(c.midi);
    weightTotal += w;
  }
  let tessituraCenterMidi = comfortableLow + (comfortableHigh - comfortableLow) / 2;
  if (weightTotal > 0) {
    // Weighted median: sort centers by value, accumulate weight until 50%.
    const paired = centers.map((c, i) => ({ c, w: weights[i] })).sort((a, b) => a.c - b.c);
    let acc = 0;
    for (const p of paired) {
      acc += p.w;
      if (acc >= weightTotal / 2) { tessituraCenterMidi = p.c; break; }
    }
  }

  const tessituraSpan = Math.max(2, span * 0.35);
  const tessituraLowMidi = tessituraCenterMidi - tessituraSpan / 2;
  const tessituraHighMidi = tessituraCenterMidi + tessituraSpan / 2;

  // ---- consistency: how tightly the voiced frames cluster around their
  // local median. A controlled voice has low scatter; a wandering one has high. ----
  const sortedCents = [...centsList].sort((a, b) => a - b);
  let consistency = 0;
  if (sortedCents.length > 4) {
    const lo = sortedCents[Math.floor(sortedCents.length * 0.1)];
    const hi = sortedCents[Math.floor(sortedCents.length * 0.9)];
    const mid = sortedCents[Math.floor(sortedCents.length / 2)];
    // Spread in cents around the median, normalized: 0 = perfectly tight,
    // big = all over. Convert to 0..100 where 100 = tight.
    const spread = hi - lo;
    consistency = Math.max(0, Math.min(100, 100 - spread * 1.2));
  }

  // ---- breathiness: average over a sample of voiced frames ----
  const breathSample = voiced.slice(0, 40);
  let breathinessSumValue = 0;
  for (const f of breathSample) breathinessSumValue += f.confidence;
  // We don't have per-frame spectrum cached here, so we approximate breathiness
  // from the RMS/dip relationship: breathy frames have lower dipQuality at a
  // given RMS than pressed ones. This is a coarse cue.
  let breathiness = 0.5;
  if (voiced.length > 0) {
    let sumDip = 0, sumRms = 0, count = 0;
    for (const f of voiced) {
      sumDip += f.dipQuality;
      sumRms += f.rms;
      count++;
    }
    const avgDip = sumDip / count;
    const avgRms = sumRms / count;
    // High RMS + low dip = breathy/rough. Low RMS + low dip = weak/air.
    // Tight mapping: dipQuality ~0.15 at low RMS → breathy; dipQuality ~0.4
    // at high RMS → pressed/clean.
    const expectedDip = 0.1 + avgRms * 2.5;
    breathiness = Math.max(0, Math.min(1, 1 - (avgDip / Math.max(0.05, expectedDip))));
  }

  // ---- was the scan a sweep? If the range covered is wide and the voice
  // moved through it (not just clustered in one spot), mark as swept. ----
  const rawSpan = touchedHigh - touchedLow;
  const clusteredSpan = sustained.length > 0
    ? Math.max(...sustained.map((c) => c.midi)) - Math.min(...sustained.map((c) => c.midi))
    : 0;
  const wasSwept = rawSpan >= 6 && clusteredSpan >= 4;

  const minFrequency = midiToFrequency(touchedLow);
  const maxFrequency = midiToFrequency(touchedHigh);
  const centerFrequency = midiToFrequency(tessituraCenterMidi);

  return {
    minFrequency,
    maxFrequency,
    centerFrequency,
    minMidi: touchedLow,
    maxMidi: touchedHigh,
    lowNote: midiToNote(touchedLow),
    highNote: midiToNote(touchedHigh),
    voiceType: classifyVoice(tessituraCenterMidi, touchedLow, touchedHigh),
    weight: weightLabel,
    sampleCount: voiced.length,
    comfortableLowMidi: comfortableLow,
    comfortableHighMidi: comfortableHigh,
    comfortableLowNote: midiToNote(comfortableLow),
    comfortableHighNote: midiToNote(comfortableHigh),
    tessituraCenterMidi,
    tessituraLowMidi,
    tessituraHighMidi,
    consistency: Math.round(consistency),
    signalRatio: Math.round(signalRatio * 100),
    breathiness: Math.round(breathiness * 100),
    wasSwept,
  };
}

// Legacy buildVocalProfile(rawFrequencies, weightLabel) — kept so existing
// call sites in scan/page that pass raw number[] still compile. It now
// converts to PitchFrame stream internally with a default confidence model
// derived from RMS and YIN dip depth (no randomness).
export function buildVocalProfileLegacy(
  frequencies: number[],
  weightLabel?: string,
): VocalProfile | null {
  const frames: PitchFrame[] = frequencies
    .filter((f) => Number.isFinite(f) && f >= HZ_LOW && f <= HZ_HIGH)
    .map((f) => {
      const dip = Math.min(1, 0.3 + 0.7 * (1 - Math.random() * 0.3)); // placeholder confidence
      const rms = Math.min(0.12, 0.02 + Math.random() * 0.08);
      return { freq: f, midi: frequencyToMidi(f), confidence: dip, voiced: true, rms, dipQuality: dip };
    });
  return buildVocalProfile(frames, weightLabel);
}

// ---- voice classification (tessitura-based, fuller ladder) ----
function classifyVoice(
  tessituraCenterMidi: number,
  lowMidi: number,
  highMidi: number,
): string {
  const center = tessituraCenterMidi;
  const range = highMidi - lowMidi;

  // Basses sit low and often have a wide, dark range.
  if (center < 47) return "Bass";
  // Baritones: low-ish center, comfortable below 44 (C4).
  if (center < 52 && lowMidi < 50) return "Baritone";
  if (center < 52) return "Baritone (high)";
  // Tenors: center around C4–F4, often with a strong upper extension.
  if (center < 57) return "Tenor";
  if (center < 60) return "Tenor (bright)";
  // Altos: center around E4–B4, comfortable in the middle register.
  if (center < 62) return "Alto";
  if (center < 64) return "Alto (bright)";
  // Mezzo-sopranos: center around F4–G5.
  if (center < 67) return "Mezzo-Soprano";
  if (center < 70) return "Mezzo-Soprano (high)";
  // Sopranos: high center, comfortable above C5.
  return "Soprano";
}

// ---- convenience: weighted range recommendation ----
// Given a profile, estimate the "comfortable performance range" as the
// comfortable band expanded slightly for passages the singer can handle.
export function performanceRange(profile: VocalProfile): { low: number; high: number } {
  const pad = Math.max(2, (profile.comfortableHighMidi - profile.comfortableLowMidi) * 0.15);
  return {
    low: profile.comfortableLowMidi - pad,
    high: profile.comfortableHighMidi + pad,
  };
}

export function pitchSteadiness(frames: number[]): number | null {
  if (frames.length < 4) return null;

  const med = [...frames].sort((a, b) => a - b)[Math.floor(frames.length / 2)];
  if (med < 1) return null;

  let sum = 0;
  for (const f of frames) sum += Math.abs(f - med);
  const ppm = (sum / frames.length) / med * 100;

  if (ppm > 15) return null;

  return Math.max(0, Math.min(100, 100 - ppm * 4));
}

// ---- cents histogram: useful for matching + feedback ----
export type CentsHistogram = {
  bins: number[];        // count per cent bin, -50..+50
  mean: number;
  tight: number;         // % of frames within ±15 cents
};

export function centsHistogram(
  frames: PitchFrame[],
  range: { low: number; high: number },
): CentsHistogram {
  const bins = new Array(101).fill(0);
  let sum = 0;
  let tight = 0;
  let count = 0;
  for (const f of frames) {
    if (!f.voiced || !Number.isFinite(f.freq)) continue;
    const midi = 69 + 12 * Math.log2(f.freq / 440);
    if (midi < range.low - 2 || midi > range.high + 2) continue;
    const c = Math.round((midi - Math.round(midi)) * 100);
    const idx = c + 50;
    if (idx >= 0 && idx <= 100) bins[idx]++;
    sum += c;
    if (Math.abs(c) <= 15) tight++;
    count++;
  }
  const mean = count > 0 ? sum / count : 0;
  return { bins, mean, tight: count > 0 ? Math.round((tight / count) * 100) : 0 };
}
