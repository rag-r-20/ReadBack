# Build Doc — "ReadBack" (Cursor track)

*Working title — the board reads itself back to you. Rename freely.*
*A voice-first job memory for tradespeople: photograph a messy consumer unit, get a clean labeled diagram, annotate it by voice, and pull it all back two days later at the shop.*

---

## Locked scope

- **Hero:** messy consumer-unit photo → **clean, readable 2D diagram** (labeled breaker tiles), not a 3D render.
- **Voice annotations** on each diagram element, transcribed and cleaned into proper notes.
- **Materials list per job**, built from voice.
- **Retrieval:** search / "ask your job" over everything, days later.
- **Wholesaler stock lookup — `?` stretch only** if you're genuinely ahead. Not on the critical path.
- **Platform:** Chrome on Windows 11 first; then Chrome on iPhone (to show it on a phone).
- **Connectivity:** assume wifi/cellular. No offline mode.

---

## The hero: messy photo → clean 2D diagram

The point is *legibility two days later*, not electrical accuracy. You are not tracing wires or reconstructing a schematic — you're turning a chaotic photo into a **tidy, labeled panel layout** you can read at the merchant's counter. Pipeline:

1. **Capture** — photograph the consumer unit (wide shot; close-ups optional).
2. **Vision parse** — send the photo to a multimodal model. It returns **strict JSON**: each module in physical order, its type (main switch / RCD / RCBO / MCB / blank), any legible rating (e.g. `32A`, `B16`), and any printed label. It does **not** guess purpose or wiring.
3. **Render** — draw a clean **SVG** row (or rows) of labeled breaker tiles in that order. Because it's SVG from structured data, it's crisp and readable. Styling this well is where your design/creativity points come from.
4. **Correct** — user can tap a tile to fix rating/type, reorder, add/remove. This is the safety net that makes a wrong parse recoverable — never let the model's mistake break the flow.
5. **Annotate by voice** — tap a tile, speak ("this is the kitchen ring, 32 amp, feeds the oven and the window sockets") → Gradium STT → LLM cleans it into a proper note attached to that tile.
6. **Materials** — speak needs ("2 metres of 6mm twin-and-earth, a spare 32A breaker") → LLM extracts to the job's materials list.
7. **Retrieve** — later, open the job → clean diagram + per-tile notes + materials, searchable.

**The money shot for the demo is the before/after:** chaotic photo on the left, tidy labeled diagram on the right. Hold on it.

**#1 risk (de-risk in hour one):** a lightweight model may parse a messy board poorly. Mitigations, both built in: (a) tile **correction** UI; (b) a **manual-placement fallback** — if the parse is unusable, let the user tap on the photo to drop tiles, still producing a clean labeled diagram, just hand-placed. Decide which path by the end of H1.

---

## Resource allocation (keep the demo path free/owned)

| Job | Use | Why |
|---|---|---|
| Photo → panel JSON (vision) | **Crusoe Nemotron Omni** (free, takes image input) — Gemini 3.1 Flash Lite as backup | Crusoe is free for participants; saves your 500/day Gemini quota during heavy testing |
| Voice note → clean note (text) | **Crusoe** (free) | High call volume; keep it off any quota |
| Voice → materials (text) | **Crusoe** (free) | Same |
| "Ask your job" retrieval (text) | **Crusoe** (free) | Same |
| Speech-to-text (+ optional TTS confirmations) | **Gradium** | You have ~13h of STT in credits; low latency, cross-platform (sidesteps flaky iOS Web Speech) |
| Hosting | **Vultr** ($200) | PWA + optional persistence/backend |

Build a thin provider switch (`llm.ts`) so you can flip Crusoe↔Gemini per call if one misbehaves. Confirm the Crusoe endpoint shape (likely OpenAI-style chat completions) and Gradium's STT endpoint in hour one.

---

## Architecture & data model

Client-heavy PWA; storage in the browser (**IndexedDB**, via `idb` or Dexie) so there's no auth/backend on the critical path. Optionally sync to a small Node service on Vultr later. HTTPS is mandatory (camera/mic) — use a real domain or an HTTPS tunnel.

```
Job { id, title, address?, createdAt, panels[], notes[], materials[] }
Panel { id, sourcePhotoId, components[], createdAt }
Component (tile) { id, order, type, rating, purposeLabel, noteIds[], confidence }
Note { id, componentId?, transcript, cleaned{purpose, rating, area_served, feeds[], cautions, note_text}, audioRef?, createdAt }
Material { id, item, quantity, unit, spec, notes, sourced? }   // sourced = stretch
```

---

## Project structure (React + Vite + TypeScript, PWA)

```
/src
  /components
    CameraCapture.tsx     // getUserMedia <video>+canvas; <input capture> fallback on mobile
    PanelDiagram.tsx      // renders SVG tiles from Panel.components; editable
    TileEditor.tsx        // fix rating/type; record voice note
    VoiceRecorder.tsx     // mic -> Gradium STT
    MaterialsList.tsx
    JobSearch.tsx         // keyword + "ask your job"
    JobList.tsx / JobView.tsx
  /lib
    gradium.ts            // STT (+ optional TTS)
    llm.ts                // provider switch: crusoe() / gemini(); vision + text
    prompts.ts            // the 4 prompts below
    diagram.ts            // panel JSON -> SVG layout
    db.ts                 // IndexedDB
    types.ts
  /state                  // zustand or context
  App.tsx / main.tsx
  /pwa                    // manifest + service worker
vite.config.ts
```

Scaffold fast with Cursor / Claude Code. Deploy to Vultr (or Vercel) over HTTPS.

---

## The prompts (copy-paste starting points)

Request **strict JSON only** and parse defensively (strip stray prose / code fences before `JSON.parse`).

**1. Vision parse — photo → panel JSON**
```
You are a vision assistant for electricians. You are shown a photo of a domestic
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
confidence. Never fabricate ratings or labels.
```

**2. Voice note → clean note (one tile)**
```
Clean an electrician's spoken note about ONE breaker into a tidy record.
Inputs: the breaker's current label/rating, and a raw voice transcript.
Return STRICT JSON:
{ "purpose": "<short, e.g. 'Kitchen ring main'>",
  "rating": "<if stated, else keep existing>",
  "area_served": "<e.g. 'Kitchen + utility'>",
  "feeds": ["<e.g. 'oven', 'window sockets'>"],
  "cautions": "<any warning stated, else null>",
  "note_text": "<1-2 clean sentences a tradesperson reads at the shop>" }
Use only information in the transcript or existing label. Do not invent.
```

**3. Voice → materials list**
```
Extract materials the electrician says they need into a job shopping list.
Return STRICT JSON array, one object per item:
[ { "item": "<e.g. 'Twin & earth cable'>",
    "quantity": <number or null>,
    "unit": "<m, each, box... or null>",
    "spec": "<e.g. '6mm2', '32A Type B MCB'; null if none>",
    "notes": "<optional>" } ]
Merge obvious duplicates. Use null when quantity/unit/spec is unclear.
Only include items actually requested.
```

**4. Ask your job (retrieval)**
```
Answer the electrician's question using ONLY this job's data (panel components,
notes, materials) given as JSON. Be concise and practical. If the answer isn't in
the data, say so plainly. After the answer, cite the source (breaker order number
and/or note) you used.
JOB DATA: <json>
QUESTION: <text>
```

---

## Timeline (~12h, 2 people)

**Split:** A = frontend/UX (capture, diagram render + editing, materials + retrieval UI, design polish). B = the brains (Gradium STT/TTS, vision parse, LLM structuring, prompts, provider wiring, IndexedDB).

- **H1 — de-risk the three scary bits (both):**
  - A: React PWA shell + camera capture working on **Chrome desktop**, then confirm on **iPhone Chrome** over HTTPS.
  - B: (1) one Gradium STT round-trip; (2) one vision parse (photo → panel JSON) on **both** Crusoe Omni and Gemini — pick the better; (3) render that JSON to a rough SVG.
  - **Gate:** if the parse is unusable after prompt tweaks, commit to the manual-placement fallback now.
- **H2–4:** A — `PanelDiagram` SVG + editable tiles (reorder / relabel / fix rating / add / remove). B — nail the vision prompt + JSON parsing + `diagram.ts` layout; IndexedDB schema.
- **H4–6:** A — `TileEditor` + `VoiceRecorder` (tap tile → record → note appears). B — voice-note→clean-note (Crusoe); attach to tile; optional Gradium TTS confirmation.
- **H6–8:** A — `MaterialsList` + `JobView`. B — voice→materials extraction + "ask your job" retrieval over stored job data.
- **H8–10:** build the demo job end-to-end with a **real** panel photo; make the before/after look great; design polish (A leads); rehearse.
- **H10–12:** polish, empty/edge states, fix the top 3 demo-breakers, **record a backup take** of the core flow while stable. Wholesaler `?` feature only if genuinely ahead.
- **Morning:** shoot the video.

---

## Demo-critical path (the winning flow)

Messy consumer-unit photo → tap **"clean up"** → tidy labeled diagram materializes (**hold on the before/after**) → tap a breaker, speak its purpose → a cleaned note appears attached to it → speak a materials need → it lands in the job's list → *two days later at the shop*, open the job, search **"kitchen ring"** → the labeled tile + notes come straight back. Close on: *"he used to walk up and down the stairs guessing — now the board reads itself back to him."*

Pre-cache every model call on the demo path so nothing depends on a live round-trip landing on cue.

---

## Shot-by-shot video (~2:30; demo is 50% of the score)

1. **0:00–0:20 — The pain.** Electrician at a messy board; voiceover of the real walk-up-and-down-the-stairs story. Show the chaotic photo on a phone.
2. **0:20–0:35 — The turn.** "What if the board could read itself back to you?"
3. **0:35–1:10 — The money shot.** Screen-recorded on Chrome: capture messy photo → clean labeled diagram appears. Linger on before/after.
4. **1:10–1:40 — Voice.** Tap a breaker, speak → cleaned note appears. Speak a materials need → it lands in the list.
5. **1:40–2:05 — On the phone.** Same app on the iPhone; retrieval: search "kitchen ring," tile + notes return. "Two days later, at the shop."
6. **2:05–2:25 — Impact + stack.** Who it's for, time saved, where it goes (all trades, team sync, sourcing next). One line naming the stack (Gradium voice, free Crusoe inference) to prove it's real.
7. **2:25–2:30 — Close** on the emotional line.

Use real tradesperson audio if you can. Record at high res. Have the backup take ready.

---

## Chrome / iPhone gotchas

- **HTTPS required** for camera/mic — real domain or HTTPS tunnel; localhost is fine for dev.
- iOS needs a **user gesture** to start mic/camera; Chrome-on-iOS is WebKit underneath, so test capture there specifically, not just desktop.
- You're using **Gradium** for STT, which avoids the flaky/absent iOS Web Speech API — good call, keep it.
- PWA install on iOS is limited; for the demo you only need it to **load and capture in the browser**, which works.
- Simple capture fallback on mobile: `<input type="file" accept="image/*" capture="environment">`.

---

## Cut list & top risks

**Cut:** one trade (electrician), one job flow; no wire-tracing / electrical accuracy (legible labels only); no accounts/auth (IndexedDB, single demo user); no offline; wholesaler lookup is `?`-stretch.

**Top risks, in order:** (1) vision parse quality → correction UI + manual fallback; (2) iOS capture quirks → test on the actual iPhone early; (3) demo-path latency → pre-cache all calls; (4) scope creep → the before/after + voice-note + retrieval loop is the whole product, protect it.
