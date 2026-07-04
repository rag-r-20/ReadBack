// Smoke test for src/lib/gradium.ts. Run with: npx tsx scripts/test-gradium.ts
//
// - If VITE_GRADIUM_API_KEY is missing (env or .env.local), prints a skip
//   message and exits 0.
// - Otherwise attempts a full round-trip: Gradium TTS speaks a test phrase,
//   the resulting WAV is fed back into Gradium STT, and the transcript is
//   checked. If TTS is unavailable (e.g. credits are STT-only), falls back
//   to POSTing a synthetic 1s WAV tone to STT just to verify auth/endpoint.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { encodeWav, speak, transcribeBlob } from "../src/lib/gradium";

// Minimal .env.local loader so the script works without exporting vars.
try {
  const envFile = readFileSync(join(process.cwd(), ".env.local"), "utf8");
  for (const line of envFile.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {
  // no .env.local — fine, rely on process env
}

if (!process.env.VITE_GRADIUM_API_KEY) {
  console.log(
    "VITE_GRADIUM_API_KEY not set — skipping Gradium smoke test.\n" +
      "Add it to .env.local (see docs/GET-YOUR-KEYS.md) and rerun.",
  );
  process.exit(0);
}

if (typeof fetch === "undefined" || typeof Blob === "undefined") {
  console.log("This script needs Node 18+ (global fetch/Blob). Skipping.");
  process.exit(0);
}

/** Synthetic 1-second 440Hz tone as a WAV blob (24kHz mono 16-bit). */
function toneWav(): Blob {
  const rate = 24000;
  const samples = new Float32Array(rate);
  for (let i = 0; i < samples.length; i++) {
    samples[i] = 0.3 * Math.sin((2 * Math.PI * 440 * i) / rate);
  }
  return new Blob([encodeWav(samples, rate)], { type: "audio/wav" });
}

const PHRASE = "Kitchen ring main, thirty two amps, feeds the oven.";

console.log("Gradium live smoke test");
console.log(`  1. TTS: synthesizing "${PHRASE}"...`);
const tts = await speak(PHRASE);

if (tts.ok) {
  console.log(`     PASS TTS — got ${tts.audio.size} bytes of WAV`);
  console.log("  2. STT: transcribing the TTS audio back...");
  const stt = await transcribeBlob(tts.audio);
  if (stt.ok && stt.transcript.length > 0) {
    console.log(`     PASS STT — transcript: "${stt.transcript}"`);
    console.log("\nFull TTS -> STT round-trip succeeded.");
  } else if (stt.ok) {
    console.log("     WARN STT returned 200 but an empty transcript.");
    console.log("\nAuth + endpoints reachable; transcript quality unverified.");
  } else {
    console.log(`     FAIL STT — ${stt.error}`);
    process.exitCode = 1;
  }
} else {
  console.log(`     TTS unavailable (${tts.error})`);
  console.log("  2. Fallback: POSTing a synthetic 1s tone WAV to STT...");
  const stt = await transcribeBlob(toneWav());
  if (stt.ok) {
    console.log(
      `     PASS STT reachable — transcript of a sine tone: "${stt.transcript}" (empty is expected)`,
    );
    console.log("\nSTT auth + endpoint verified; TTS not available on this key.");
  } else {
    console.log(`     FAIL STT — ${stt.error}`);
    process.exitCode = 1;
  }
}
