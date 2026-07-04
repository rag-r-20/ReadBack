# Person B lib layer — integration guide

Everything under `src/lib/` that the UI (Person A) codes against. All fallible calls return a
`Result<T>`-style object and **never throw** — check `.ok` and branch. API keys come from
`.env.local` (copy `.env.example`; see `docs/GET-YOUR-KEYS.md`).

Smoke tests: `npm run test:diagram`, `npm run test:llm`, `npm run test:gradium`.

## `src/lib/env.ts`

```ts
function getEnv(name: string): string | undefined
```

Reads `import.meta.env` in the browser (Vite) and falls back to `process.env` under node/tsx.
All key access goes through this — e.g. `getEnv('VITE_GEMINI_API_KEY')`. You should not need it
directly; the lib functions call it themselves.

## `src/lib/types.ts` — the shared contract

Import types from here, never redeclare.

- `ComponentType` — `'main_switch' | 'RCD' | 'RCBO' | 'MCB' | 'blank' | 'other'`
- LLM response shapes: `VisionComponent`, `VisionParse` (photo → panel JSON), `CleanedNote`
  (voice note → structured note), `MaterialItem` (voice → materials)
- Persisted model: `Job`, `Panel`, `PanelComponent`, `Note`, `Material`
- `Result<T>` — `{ ok: true; value: T } | { ok: false; error: string; raw?: string }`

## `src/lib/db.ts` — IndexedDB via Dexie (database name `readback`)

Tables `jobs`, `panels`, `notes`, `materials`, all keyed by `id`; panel/note/material rows are
indexed by `jobId`. **Browser-only** — it instantiates Dexie at module load, so don't import it
in node scripts.

```ts
const db: Dexie                          // raw handle if you need it
function newId(): string                 // crypto.randomUUID()

// Jobs
function createJob(title: string, address?: string): Promise<Job>
function getJob(jobId: string): Promise<Job | undefined>
function listJobs(): Promise<Job[]>                      // newest first
function deleteJob(jobId: string): Promise<void>         // cascades to panels/notes/materials

// Panels & tiles
function addPanel(jobId: string, components: PanelComponent[], sourcePhotoId?: string): Promise<Panel>
function getPanelsForJob(jobId: string): Promise<Panel[]>
function updateComponent(panelId: string, componentId: string,
                         patch: Partial<Omit<PanelComponent, 'id'>>): Promise<void>
function visionParseToComponents(parse: VisionParse): PanelComponent[]
// maps printed_label → purposeLabel, noteIds: [], keeps order/type/rating/confidence

// Notes (also appends note.id to the tile's noteIds when componentId is given)
function addNote(jobId: string, transcript: string, cleaned: CleanedNote,
                 opts?: { componentId?: string; audioRef?: string }): Promise<Note>
function getNotesForJob(jobId: string): Promise<Note[]>

// Materials
function addMaterials(jobId: string, items: MaterialItem[]): Promise<Material[]>
function getMaterialsForJob(jobId: string): Promise<Material[]>
function toggleMaterialSourced(materialId: string): Promise<void>

// Retrieval — one object for the "ask your job" prompt
interface JobData { job: Job; panels: Panel[]; notes: Note[]; materials: Material[] }
function assembleJobData(jobId: string): Promise<JobData | undefined>
```

## `src/lib/diagram.ts` — panel → tiles/SVG (pure; no React, no DOM; safe in node)

```ts
type DiagramComponent = PanelComponent | VisionComponent   // both accepted
interface DiagramInput { components: DiagramComponent[]; rows?: number; title?: string }

function toPanelComponent(c: DiagramComponent): PanelComponent  // normalizes the vision shape
function layoutPanel(input: DiagramInput): PanelLayout
// PanelLayout = { width, height, rows, headerHeight, tiles: TileLayout[] }
// TileLayout  = { component, x, y, width, height, row }

function renderPanelSvg(input: DiagramInput): string   // complete standalone SVG document

const TILE: { width; height; gap; padding; rowGap; titleHeight }   // layout constants
const TYPE_STYLES: Record<ComponentType, TypeStyle>   // fill/stroke/accent/caption per type
```

`layoutPanel` + `TYPE_STYLES` are exported so `PanelDiagram.tsx` can render interactive React
tiles with identical geometry/colors; `renderPanelSvg` is for export/preview. Tiles show:
position number, type caption pill, toggle nub, rating (bold), purpose label (wrapped, max
2 lines), and a yellow `?` badge when `confidence < 0.5`.

## `src/lib/prompts.ts`

`VISION_PARSE_PROMPT` (const), `cleanNotePrompt(existingLabel, rating, transcript)`,
`MATERIALS_PROMPT` (const) / `materialsPrompt(transcript)`, `askJobPrompt(jobJson, question)` —
copied verbatim from the build doc. Only `llm.ts` consumes these; the UI shouldn't need them.

## `src/lib/llm.ts` — provider switch (Gemini primary, Vultr optional)

**Gemini** (`gemini-3-flash-preview`, REST, no SDK) handles vision and text. **Vultr Serverless
Inference** (`kimi-k2-instruct`, OpenAI-compatible) is an optional text-only secondary: when
`VITE_VULTR_API_KEY` is set, text calls go to Vultr first (conserves Gemini free-tier quota) and
any Vultr failure falls back to Gemini automatically. Vision always uses Gemini. Every function
returns `Result<T>` and never throws.

```ts
type TextProvider = 'gemini' | 'vultr';

// Photo → panel JSON (prompt 1). Vision is Gemini-only.
function visionParse(imageBase64: string, mimeType: string,
                     opts?: { provider?: 'gemini' }): Promise<Result<VisionParse>>

// Raw transcript about one breaker → structured note (prompt 2).
function cleanNote(existingLabel: string | null, rating: string | null, transcript: string,
                   opts?: { provider?: TextProvider }): Promise<Result<CleanedNote>>

// Transcript → shopping-list items (prompt 3). Missing qty/unit/spec come back null.
function extractMaterials(transcript: string,
                          opts?: { provider?: TextProvider }): Promise<Result<MaterialItem[]>>

// Question over one job's data (pass JSON.stringify of JobData) → plain-text answer (prompt 4).
function askJob(jobJson: string, question: string,
                opts?: { provider?: TextProvider }): Promise<Result<string>>

// Defensive JSON extraction (exported for reuse): strips ```json fences, <think> blocks and
// surrounding prose, then parses. Truncated/invalid output → { ok: false, error, raw }.
function extractJson<T>(raw: string): Result<T>
```

On any `ok: false` from `visionParse`, the UI should offer the manual tile-placement fallback.

## `src/lib/gradium.ts` — speech-to-text (+ optional TTS)

One-shot REST against Gradium (`x-api-key` auth); requires `VITE_GRADIUM_API_KEY`. No WebSocket
needed — MediaRecorder hands us a complete blob. Never throws.

```ts
// Voice note blob → transcript. Accepts whatever MediaRecorder produces (webm/opus on Chrome,
// mp4/aac on Safari/iOS, ogg, wav) — non-WAV input is decoded with WebAudio and re-encoded to
// WAV before upload.
function transcribeBlob(audio: Blob):
  Promise<{ ok: true; transcript: string } | { ok: false; error: string }>

// Optional TTS confirmation. Returns a playable WAV blob (does not autoplay).
function speak(text: string):
  Promise<{ ok: true; audio: Blob } | { ok: false; error: string }>

// Endpoint/model/voice settings in one place; verify against the dashboard if anything 404s.
const GRADIUM_CONFIG: { restBase; sttPath; ttsPath; sttModel; language; ttsVoiceId; uploadSampleRate }

// Utility: Float32 samples → 16-bit mono WAV bytes (used by the smoke test).
function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer
```

---

# End-to-end flows (copy-paste)

## 1. Photo → `visionParse` → panel → `renderPanelSvg`

```ts
import { visionParse } from './lib/llm';
import { createJob, addPanel, visionParseToComponents } from './lib/db';
import { renderPanelSvg } from './lib/diagram';

const res = await visionParse(imageBase64, 'image/jpeg');
if (!res.ok) return offerManualPlacement(res.error);   // safety net, never a dead end

const job = await createJob('14 Elm Road');
const panel = await addPanel(job.id, visionParseToComponents(res.value), photoId);

const svg = renderPanelSvg({ components: panel.components, rows: res.value.panel.rows });
// <div dangerouslySetInnerHTML={{ __html: svg }} /> — or layoutPanel() for interactive tiles
```

## 2. Tile voice note: `transcribeBlob` → `cleanNote` → `addNote`

```ts
import { transcribeBlob, speak } from './lib/gradium';
import { cleanNote } from './lib/llm';
import { addNote } from './lib/db';

// blob = MediaRecorder output for one tap-to-record voice note
const stt = await transcribeBlob(blob);
if (!stt.ok) return toast(stt.error);

const cleaned = await cleanNote(tile.purposeLabel, tile.rating, stt.transcript);
if (!cleaned.ok) return toast(cleaned.error);

await addNote(job.id, stt.transcript, cleaned.value, { componentId: tile.id });
// optional spoken confirmation:
const tts = await speak('Note saved.');
if (tts.ok) void new Audio(URL.createObjectURL(tts.audio)).play();
```

## 3. Voice → materials: `transcribeBlob` → `extractMaterials` → `addMaterials`

```ts
import { transcribeBlob } from './lib/gradium';
import { extractMaterials } from './lib/llm';
import { addMaterials } from './lib/db';

const stt = await transcribeBlob(blob);
if (!stt.ok) return toast(stt.error);

const items = await extractMaterials(stt.transcript);
if (!items.ok) return toast(items.error);

await addMaterials(job.id, items.value);   // [{ item, quantity, unit, spec, notes? }]
```

## 4. Ask your job: `assembleJobData` → `askJob`

```ts
import { assembleJobData } from './lib/db';
import { askJob } from './lib/llm';

const data = await assembleJobData(job.id);   // { job, panels, notes, materials }
if (!data) return;

const answer = await askJob(JSON.stringify(data), 'what rating is the kitchen ring?');
if (answer.ok) showAnswer(answer.value);      // plain text, cites breaker/note sources
```
