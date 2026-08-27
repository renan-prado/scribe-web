/**
 * Build an object-URL for a tiny silent WAV file we can loop through an
 * `<audio>` element. Playing silent audio during a capture session is the
 * cheapest way to convince Chromium/WebKit/Blink that "media is actively
 * playing" — which in turn:
 *   - defeats background-tab timer throttling (setInterval keeps its cadence),
 *   - lets Media Session lock-screen controls appear on Android,
 *   - prevents the OS from aggressively suspending Chrome under memory pressure,
 *   - prevents AudioContext auto-suspension on some browsers.
 *
 * The file is generated on the fly (44-byte header + N zero samples) so we
 * don't have to ship a binary asset.
 */
export function createSilentWavUrl(seconds = 2): string {
  const sampleRate = 8000;
  const numSamples = sampleRate * seconds;
  const headerBytes = 44;
  const buffer = new ArrayBuffer(headerBytes + numSamples);
  const view = new DataView(buffer);

  // RIFF chunk descriptor
  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + numSamples, true);
  writeAscii(view, 8, "WAVE");

  // fmt sub-chunk
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true); // subchunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate, true); // byte rate = sampleRate * channels * bits/8
  view.setUint16(32, 1, true); // block align
  view.setUint16(34, 8, true); // 8 bits per sample

  // data sub-chunk
  writeAscii(view, 36, "data");
  view.setUint32(40, numSamples, true);
  // 8-bit unsigned PCM: 128 = zero-crossing (true silence)
  for (let i = 0; i < numSamples; i++) view.setUint8(headerBytes + i, 128);

  const blob = new Blob([buffer], { type: "audio/wav" });
  return URL.createObjectURL(blob);
}

function writeAscii(view: DataView, offset: number, s: string): void {
  for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
}
