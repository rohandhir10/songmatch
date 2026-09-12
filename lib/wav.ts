// Minimal WAV (16-bit PCM mono) codec for the native Scan path.
// Why: expo-av can record uncompressed WAV on device; this decodes the file
// bytes to Float32Array so profileFromPcm() (YIN) can analyze them — same
// math as web, no native module needed for v1.
export function encodeWavPcm16(pcm: Float32Array, sampleRate: number): Uint8Array {
  const buf = new ArrayBuffer(44 + pcm.length * 2);
  const v = new DataView(buf);
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  v.setUint32(4, 36 + pcm.length * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  writeStr(36, "data");
  v.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) {
    const s = Math.max(-1, Math.min(1, pcm[i]));
    v.setInt16(44 + i * 2, Math.round(s * 32767), true);
  }
  return new Uint8Array(buf);
}

export function decodeWavPcm16(bytes: Uint8Array): {
  pcm: Float32Array;
  sampleRate: number;
} {
  if (bytes.length < 44) throw new Error("too short for WAV header");
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const readStr = (off: number, len: number) => {
    let s = "";
    for (let i = 0; i < len; i++) s += String.fromCharCode(v.getUint8(off + i));
    return s;
  };
  if (readStr(0, 4) !== "RIFF" || readStr(8, 4) !== "WAVE" || readStr(12, 4) !== "fmt ") {
    throw new Error("not a WAV file");
  }
  if (v.getUint16(20, true) !== 1) throw new Error("only PCM supported");
  const channels = v.getUint16(22, true);
  if (channels !== 1) throw new Error(`only mono supported, got ${channels}`);
  if (v.getUint16(34, true) !== 16) throw new Error("only 16-bit supported");
  const sampleRate = v.getUint32(24, true);
  const dataLen = v.getUint32(40, true);
  const count = Math.floor(dataLen / 2);
  const pcm = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pcm[i] = v.getInt16(44 + i * 2, true) / 32768;
  }
  return { pcm, sampleRate };
}
