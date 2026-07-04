// The 4 prompts from readback-build-doc.md, copied faithfully, exposed as
// constants / template functions. llm.ts is the only consumer.

/** Prompt 1: vision parse — photo → panel JSON. Send with the image attached. */
export const VISION_PARSE_PROMPT = `You are a vision assistant for electricians. You are shown a photo of a domestic
consumer unit / distribution board. Identify ONLY what is visibly present. Do NOT
infer wiring, circuits served, or purpose. Return STRICT JSON only, no prose.

{
  "panel": { "ways": <int total module positions if countable, else null>, "rows": <int, default 1> },
  "components": [
    { "id": "c1",
      "order": <int, left-to-right then top-to-bottom, starting at 1>,
      "type": "main_switch | RCD | RCBO | MCB | blank | other",
      "rating": "<e.g. 32A, B16, 63A; null if not legible>",
      "printed_label": "<text printed on/near it; null if none>",
      "confidence": <0.0-1.0> }
  ]
}
Order strictly by physical position. If unsure of type, use "other" with low
confidence. Never fabricate ratings or labels.`;

/** Prompt 2: voice note → clean note (one tile). */
export function cleanNotePrompt(
  existingLabel: string | null,
  rating: string | null,
  transcript: string,
): string {
  return `Clean an electrician's spoken note about ONE breaker into a tidy record.
Inputs: the breaker's current label/rating, and a raw voice transcript.
Return STRICT JSON:
{ "purpose": "<short, e.g. 'Kitchen ring main'>",
  "rating": "<if stated, else keep existing>",
  "area_served": "<e.g. 'Kitchen + utility'>",
  "feeds": ["<e.g. 'oven', 'window sockets'>"],
  "cautions": "<any warning stated, else null>",
  "note_text": "<1-2 clean sentences a tradesperson reads at the shop>" }
Use only information in the transcript or existing label. Do not invent.

EXISTING LABEL: ${existingLabel ?? "(none)"}
EXISTING RATING: ${rating ?? "(none)"}
TRANSCRIPT: ${transcript}`;
}

/** Prompt 3: voice → materials list (base instruction, no transcript). */
export const MATERIALS_PROMPT = `Extract materials the electrician says they need into a job shopping list.
Return STRICT JSON array, one object per item:
[ { "item": "<e.g. 'Twin & earth cable'>",
    "quantity": <number or null>,
    "unit": "<m, each, box... or null>",
    "spec": "<e.g. '6mm2', '32A Type B MCB'; null if none>",
    "notes": "<optional>" } ]
Merge obvious duplicates. Use null when quantity/unit/spec is unclear.
Only include items actually requested.`;

/** Prompt 3 with the transcript appended — what llm.ts actually sends. */
export function materialsPrompt(transcript: string): string {
  return `${MATERIALS_PROMPT}

TRANSCRIPT: ${transcript}`;
}

/** Prompt 4: ask your job (retrieval). jobJson = JSON.stringify of the job. */
export function askJobPrompt(jobJson: string, question: string): string {
  return `Answer the electrician's question using ONLY this job's data (panel components,
notes, materials) given as JSON. Be concise and practical. If the answer isn't in
the data, say so plainly. After the answer, cite the source (breaker order number
and/or note) you used.
JOB DATA: ${jobJson}
QUESTION: ${question}`;
}
