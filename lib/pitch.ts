export type VocalProfile = {
  minFrequency: number;
  maxFrequency: number;
  centerFrequency: number;

  minMidi: number;
  maxMidi: number;

  lowNote: string;
  highNote: string;

  voiceType: string;

  sampleCount: number;
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

  let bestOffset = -1;
  let bestCorrelation = 0;

  for (
    let offset = 20;
    offset < size / 2;
    offset++
  ) {
    let correlation = 0;

    for (
      let i = 0;
      i < size / 2;
      i++
    ) {
      correlation += buffer[i] * buffer[i + offset];
    }

    correlation /= size / 2;

    if (correlation > bestCorrelation) {
      bestCorrelation = correlation;
      bestOffset = offset;
    }
  }

  if (bestOffset === -1 || bestCorrelation < 0.01) {
    return -1;
  }

  return sampleRate / bestOffset;
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
  const range = maxMidi - minMidi;

  if (centerFrequency < 115 && range >= 18) {
    return "Bass / Baritone";
  }

  if (centerFrequency < 145) {
    return "Baritone";
  }

  if (centerFrequency < 185) {
    return "Tenor";
  }

  return "Higher Voice";
}

export function buildVocalProfile(
  frequencies: number[]
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
  };
}
