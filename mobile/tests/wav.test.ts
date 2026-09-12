import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { decodeWavPcm16, encodeWavPcm16 } from "../src/lib/wav.ts";

describe("wav PCM roundtrip (native Scan recording path)", () => {
  it("encodes then decodes a 220Hz tone without damage", () => {
    const sr = 44100;
    const n = 4096;
    const pcm = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pcm[i] = 0.5 * Math.sin((2 * Math.PI * 220 * i) / sr);
    }
    const bytes = encodeWavPcm16(pcm, sr);
    const decoded = decodeWavPcm16(bytes);
    assert.equal(decoded.sampleRate, sr);
    assert.equal(decoded.pcm.length, n);
    let maxErr = 0;
    for (let i = 0; i < n; i++) {
      maxErr = Math.max(maxErr, Math.abs(decoded.pcm[i] - pcm[i]));
    }
    assert.ok(maxErr < 1 / 32768 + 1e-6, `maxErr ${maxErr}`);
  });

  it("rejects non-WAV bytes", () => {
    assert.throws(() => decodeWavPcm16(new Uint8Array([1, 2, 3, 4])));
  });
});
