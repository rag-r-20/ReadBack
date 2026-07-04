// Smoke test for src/lib/llm.ts. Run with: npx tsx scripts/test-llm.ts
//
// - If VITE_GEMINI_API_KEY is set (env or .env.local), makes one live cheap
//   Gemini text call and reports the result.
// - Always validates extractJson against canned model outputs (offline).

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { askJob, extractJson, normalizeVisionParse } from "../src/lib/llm";

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

let passed = 0;
let failed = 0;

function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    passed++;
    console.log(`  PASS ${name}`);
  } else {
    failed++;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

console.log("extractJson offline tests:");

// 1. Plain JSON object
{
  const r = extractJson<{ a: number }>('{"a": 1}');
  check("plain JSON object", r.ok && r.value.a === 1);
}

// 2. JSON in ```json fences
{
  const r = extractJson<{ panel: { rows: number } }>(
    'Here you go:\n```json\n{"panel": {"rows": 1}}\n```',
  );
  check("fenced ```json block", r.ok && r.value.panel.rows === 1);
}

// 3. Bare ``` fences
{
  const r = extractJson<number[]>("```\n[1, 2, 3]\n```");
  check("bare ``` fences (array)", r.ok && r.value.length === 3);
}

// 4. JSON surrounded by prose
{
  const r = extractJson<{ ok: boolean }>(
    'Sure! Based on the photo, the result is {"ok": true} — let me know if you need more.',
  );
  check("JSON with prose before and after", r.ok && r.value.ok === true);
}

// 5. Array with trailing prose
{
  const r = extractJson<Array<{ item: string }>>(
    '[{"item": "Twin & earth cable"}]\nHope that helps!',
  );
  check("array with trailing prose", r.ok && r.value[0].item.startsWith("Twin"));
}

// 6. <think> block before the answer
{
  const r = extractJson<{ x: number }>(
    '<think>The user wants JSON {maybe} like this</think>{"x": 5}',
  );
  check("<think> block stripped", r.ok && r.value.x === 5);
}

// 7. Truncated JSON — must return ok:false, not throw
{
  const r = extractJson<unknown>('{"panel": {"ways": 8, "components": [{"id":');
  check("truncated JSON returns ok:false", !r.ok);
}

// 8. Invalid JSON — must return ok:false, not throw
{
  const r = extractJson<unknown>("{not: 'valid', json}");
  check("invalid JSON returns ok:false", !r.ok);
}

// 9. No JSON at all
{
  const r = extractJson<unknown>("I could not identify any components, sorry.");
  check("prose with no JSON returns ok:false", !r.ok);
}

// 10. Empty string
{
  const r = extractJson<unknown>("");
  check("empty string returns ok:false", !r.ok);
}

console.log(`\nextractJson: ${passed} passed, ${failed} failed`);

console.log("\nnormalizeVisionParse offline tests:");
{
  const loose = {
    panel: { ways: "12", rows: "2", cols: "6" },
    components: [
      {
        id: "c1",
        order: "1",
        row: "1",
        col: "1",
        type: "MCB",
        rating: "32A",
        printed_label: "Kitchen",
        confidence: "0.9",
      },
    ],
  };
  const n = normalizeVisionParse(loose);
  check(
    "coerces string numbers",
    n !== null &&
      n.panel.rows === 2 &&
      n.components[0].order === 1 &&
      n.components[0].type === "MCB",
  );
}
{
  const n = normalizeVisionParse({ panel: {}, components: [] });
  check("rejects empty components", n === null);
}

console.log(`\nnormalizeVisionParse: ${passed} passed, ${failed} failed`);

// ---------- Optional live call ----------

async function live() {
  if (!process.env.VITE_GEMINI_API_KEY) {
    console.log(
      "\nVITE_GEMINI_API_KEY not set — skipping live Gemini call. " +
        "Add it to .env.local and rerun for a live smoke test.",
    );
    return;
  }
  console.log("\nLive Gemini smoke test (askJob, tiny payload)...");
  const job = JSON.stringify({
    panels: [{ components: [{ order: 1, type: "MCB", rating: "32A", purposeLabel: "Kitchen ring" }] }],
    notes: [],
    materials: [],
  });
  const r = await askJob(job, "What rating is the kitchen ring?", {
    provider: "gemini",
  });
  if (r.ok) {
    console.log(`  PASS live askJob — answer: ${r.value.slice(0, 200)}`);
  } else {
    console.log(`  FAIL live askJob — ${r.error}`);
    process.exitCode = 1;
  }
}

await live();
if (failed > 0) process.exitCode = 1;
