// Gradium speech-to-text (+ optional TTS) client — browser-friendly, REST only.
//
// API shapes verified against https://docs.gradium.ai (July 2026):
//  - Auth: `x-api-key` header on every request.
//  - STT (one-shot REST): POST https://api.gradium.ai/api/post/speech/asr
//    with raw audio bytes as the body. Content-Type selects the format
//    (audio/wav recommended; PCM must be 24kHz 16-bit signed LE mono; opus
//    must be ogg-wrapped). Options go in a URL-encoded `json_config` query
//    param, e.g. {"language":"en"}. Response is NDJSON: {"type":"text",
//    "text":...} chunks, then {"type":"end_text"}; {"type":"error",
//    "message":...} on mid-stream failure.
//  - STT (WebSocket): wss://api.gradium.ai/api/speech/asr exists for live
//    streaming, but browsers can't set headers on WebSocket (needs a
//    server-minted browser token), so we deliberately use REST from the
//    browser — MediaRecorder gives us a complete blob anyway.
//  - TTS (one-shot REST): POST https://api.gradium.ai/api/post/speech/tts
//    with JSON {text, voice_id, output_format, only_audio:true} → raw audio
//    bytes (Content-Type audio/wav).
//
// MediaRecorder produces webm/opus on Chrome and mp4/aac on Safari/iOS —
// neither is accepted by Gradium directly (it wants wav / raw pcm /
// ogg-opus). transcribeBlob therefore decodes the blob with WebAudio and
// re-encodes it to 16-bit mono WAV before upload, which works for any
// MediaRecorder output in any modern browser.

import { getEnv } from "./env";

// !!! ------------------------------------------------------------------ !!!
// !!! VERIFY these against the Gradium dashboard/docs (docs.gradium.ai)  !!!
// !!! before the demo — endpoints & voice ids researched July 2026 but   !!!
// !!! hackathon accounts may differ (e.g. available voices/models).      !!!
// !!! ------------------------------------------------------------------ !!!
export const GRADIUM_CONFIG = {
  /** Base for REST endpoints. */
  restBase: "https://api.gradium.ai/api",
  /** One-shot STT: POST raw audio bytes, receive NDJSON transcript. */
  sttPath: "/post/speech/asr",
  /** One-shot TTS: POST JSON, receive raw audio bytes (only_audio:true). */
  ttsPath: "/post/speech/tts",
  /** STT model alias ("default" per docs). */
  sttModel: "default",
  /** Transcription language hint (en/fr/de/es/pt supported). */
  language: "en",
  /** TTS voice — the id used throughout Gradium's own docs examples.
   *  Swap for any id from the dashboard's voice library. */
  ttsVoiceId: "YTpq7expH9539ERJ",
  /** Sample rate we re-encode mic audio to before upload (STT native rate). */
  uploadSampleRate: 24000,
};

export type TranscribeResult =
  | { ok: true; transcript: string }
  | { ok: false; error: string };

export type SpeakResult =
  | { ok: true; audio: Blob }
  | { ok: false; error: string };

function apiKey(): string | undefined {
  return getEnv("VITE_GRADIUM_API_KEY");
}

// ---------- STT ----------

/**
 * MediaRecorder blob → transcript. Main entry point for voice notes:
 * accepts webm/opus (Chrome), mp4/aac (Safari/iOS), ogg, or wav blobs.
 * Never throws — always returns a result object.
 */
export async function transcribeBlob(audio: Blob): Promise<TranscribeResult> {
  const key = apiKey();
  if (!key) {
    return { ok: false, error: "VITE_GRADIUM_API_KEY is not set (.env.local)" };
  }
  if (audio.size === 0) {
    return { ok: false, error: "Empty audio blob (no audio recorded?)" };
  }
  try {
    let wavBytes: ArrayBuffer;
    if (audio.type.toLowerCase().includes("wav")) {
      wavBytes = await audio.arrayBuffer();
    } else if (typeof AudioContext !== "undefined") {
      wavBytes = await blobToWav(audio);
    } else {
      return {
        ok: false,
        error: `Cannot convert '${audio.type}' outside a browser; pass a WAV blob`,
      };
    }
    return await postSttWav(wavBytes, key);
  } catch (err) {
    return { ok: false, error: errText("Gradium STT", err) };
  }
}

async function postSttWav(
  wav: ArrayBuffer,
  key: string,
): Promise<TranscribeResult> {
  const jsonConfig = encodeURIComponent(
    JSON.stringify({ language: GRADIUM_CONFIG.language }),
  );
  const url = `${GRADIUM_CONFIG.restBase}${GRADIUM_CONFIG.sttPath}?json_config=${jsonConfig}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "x-api-key": key, "Content-Type": "audio/wav" },
    body: wav,
  });
  if (!res.ok) {
    const body = (await res.text().catch(() => "")).slice(0, 300);
    return { ok: false, error: `Gradium STT HTTP ${res.status}: ${body}` };
  }
  // Body is NDJSON; collect every {"type":"text"} chunk.
  const body = await res.text();
  const parts: string[] = [];
  for (const line of body.split("\n")) {
    if (!line.trim()) continue;
    let msg: { type?: string; text?: string; message?: string };
    try {
      msg = JSON.parse(line) as typeof msg;
    } catch {
      continue; // tolerate non-JSON noise
    }
    if (msg.type === "text" && msg.text) parts.push(msg.text);
    if (msg.type === "error") {
      return { ok: false, error: `Gradium STT: ${msg.message ?? line}` };
    }
  }
  return { ok: true, transcript: parts.join(" ").replace(/\s+/g, " ").trim() };
}

// ---------- TTS (optional spoken confirmations) ----------

/**
 * Text → WAV audio blob (does not auto-play; caller decides).
 * Browser playback: `new Audio(URL.createObjectURL(result.audio)).play()`.
 */
export async function speak(text: string): Promise<SpeakResult> {
  const key = apiKey();
  if (!key) {
    return { ok: false, error: "VITE_GRADIUM_API_KEY is not set (.env.local)" };
  }
  try {
    const res = await fetch(
      `${GRADIUM_CONFIG.restBase}${GRADIUM_CONFIG.ttsPath}`,
      {
        method: "POST",
        headers: { "x-api-key": key, "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          voice_id: GRADIUM_CONFIG.ttsVoiceId,
          output_format: "wav",
          only_audio: true,
        }),
      },
    );
    if (!res.ok) {
      const body = (await res.text().catch(() => "")).slice(0, 300);
      return { ok: false, error: `Gradium TTS HTTP ${res.status}: ${body}` };
    }
    return {
      ok: true,
      audio: new Blob([await res.arrayBuffer()], { type: "audio/wav" }),
    };
  } catch (err) {
    return { ok: false, error: errText("Gradium TTS", err) };
  }
}

// ---------- Audio conversion (browser only) ----------

/** Decode any browser audio blob and re-encode as 16-bit mono WAV. */
async function blobToWav(blob: Blob): Promise<ArrayBuffer> {
  const ctx = new AudioContext({ sampleRate: GRADIUM_CONFIG.uploadSampleRate });
  try {
    const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
    return encodeWav(decoded.getChannelData(0), decoded.sampleRate);
  } finally {
    await ctx.close();
  }
}

/** Float32 samples → 16-bit PCM mono WAV file bytes. */
export function encodeWav(
  samples: Float32Array,
  sampleRate: number,
): ArrayBuffer {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buf);
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeStr(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buf;
}

function errText(prefix: string, err: unknown): string {
  return `${prefix}: ${err instanceof Error ? err.message : String(err)}`;
}
