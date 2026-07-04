# Person A Plan — ReadBack Frontend/UX

Person A owns `src/App.tsx` and everything under `src/components/`. Person B's lib layer
(`src/lib/`) is **done and stable** — `db.ts` (Dexie/IndexedDB), `llm.ts` (Gemini + optional
Vultr, all calls return `Result<T>` and never throw), `gradium.ts` (STT/TTS from a
MediaRecorder blob), `diagram.ts` (pure layout: `layoutPanel` + `TYPE_STYLES` for interactive
React tiles, `renderPanelSvg` for export). Code against `src/lib/types.ts` only; integration
recipes are in `docs/B-INTEGRATION.md`.

Decisions locked with the user:

- **Styling:** Tailwind CSS.
- **Visual direction:** light, clean, high-contrast "utility tool" look.
- **Navigation:** react-router with real URLs.

Known gap to close ourselves: the DB has no photo table — `Panel.sourcePhotoId` is just a
string. We add a tiny `photos` table (Dexie version 2 bump in `db.ts`, coordinate the one-line
schema change with B) storing `{ id, blob, createdAt }`, so the before/after view can show the
original photo.

---

## Phase 0 — App shell & plumbing (~45 min)

Goal: a navigable, styled skeleton every later feature drops into.

- Install `tailwindcss` (v4, via `@tailwindcss/vite`) and `react-router`.
- Route map:
  - `/` → `JobList` (all jobs, newest first, "New job" button)
  - `/job/:jobId` → `JobView` (tabs/sections: Diagram, Notes, Materials, Ask)
  - `/job/:jobId/capture` → `CameraCapture`
- Shared UI primitives in `src/components/ui/`: button, card, modal/sheet, toast (needed
  everywhere since lib errors surface as `{ ok: false, error }` toasts).
- Layout: mobile-first single column, max-width container on desktop; sticky top bar with
  job title + back navigation.
- `JobList` wired to `listJobs()` / `createJob()` / `deleteJob()` with an empty state.

Exit: can create a job, open it, see empty sections, navigate back.

## Phase 1 — Capture → clean diagram (the hero) (~2.5 h)

Goal: messy photo in, tidy labeled SVG board out, with the before/after money shot.

- `CameraCapture.tsx`:
  - Desktop Chrome: `getUserMedia` → `<video>` + canvas snapshot.
  - Mobile/iOS fallback: `<input type="file" accept="image/*" capture="environment">`.
  - Downscale to ~1280px longest edge, export JPEG base64 (keeps Gemini payloads fast).
- On capture: save photo blob to the new `photos` table → `visionParse(base64, 'image/jpeg')`
  → on success `addPanel(jobId, visionParseToComponents(res.value), photoId)` → navigate to
  the job's Diagram view. Show a clear "Reading your board…" progress state during the call.
- `PanelDiagram.tsx`: interactive React SVG using `layoutPanel()` + `TYPE_STYLES` +
  `TILE` constants (identical geometry to B's static render). Tiles show position, type
  caption, rating, purpose label, low-confidence `?` badge, note marker when `noteIds.length > 0`.
- **Before/after view**: original photo and clean diagram side by side (stacked on mobile) —
  this is the demo's money shot, style it deliberately.
- **Manual-placement fallback** (mandatory safety net): if `visionParse` returns `ok: false`,
  show the photo with an "Add tiles by hand" flow — tap to append tiles in order, pick
  type/rating per tile — then `addPanel` the hand-built list. Never a dead end.

Exit: real photo → labeled diagram renders; failed parse → manual path still yields a diagram.

## Phase 2 — Tile correction & editing (~1.5 h)

Goal: any wrong parse is recoverable in seconds.

- `TileEditor.tsx` as a bottom sheet/modal on tile tap: edit type (the 6 `ComponentType`
  values), rating, purpose label; delete tile; add tile before/after; persist with
  `updateComponent(panelId, tileId, patch)`.
- Reorder: simple left/right "move" buttons in the editor (skip drag-and-drop — hackathon).
  Rewrite `order` fields on the affected tiles.
- Selected-tile highlight on the diagram; optimistic UI updates, re-read panel after writes.

Exit: every field of every tile is fixable; add/remove/reorder work.

## Phase 3 — Voice notes per tile (~1.5 h)

Goal: tap a breaker, speak, a clean note appears attached to it.

- `VoiceRecorder.tsx` (reusable): MediaRecorder start/stop with a clear recording state
  (pulsing indicator + elapsed time), returns a blob. Requires a user gesture (iOS rule).
- In `TileEditor`: record → `transcribeBlob(blob)` → `cleanNote(tile.purposeLabel,
  tile.rating, transcript)` → `addNote(jobId, transcript, cleaned, { componentId })`.
  Pipeline states: "Transcribing… → Cleaning… → Saved", each failure a toast, never a crash.
- Show the cleaned note (`note_text`, plus purpose/feeds/cautions chips) on the tile's editor
  and in a Notes list in `JobView`; if `cleaned.rating` differs from tile, offer one-tap
  "apply rating to tile".
- Optional (if smooth): Gradium `speak('Note saved.')` TTS confirmation.

Exit: tap tile → speak → note visible on tile and in Notes list, persisted.

## Phase 4 — Materials list (~1 h)

Goal: speak needs, get a shopping list.

- `MaterialsList.tsx` in `JobView`: reuse `VoiceRecorder` → `transcribeBlob` →
  `extractMaterials(transcript)` → `addMaterials(jobId, items)`.
- Render rows as item + quantity/unit + spec; checkbox wired to `toggleMaterialSourced()`
  ("got it" at the wholesaler); manual add row as a fallback for a bad extraction.

Exit: spoken "2 metres of 6mm twin-and-earth and a spare 32A breaker" lands as two rows.

## Phase 5 — Retrieval: search & "ask your job" (~1 h)

Goal: two days later, everything comes straight back.

- `JobSearch.tsx` in `JobView`:
  - Instant keyword filter over tiles (purpose/rating/label), notes and materials — pure
    client-side, highlights matching tiles on the diagram.
  - "Ask" box: `assembleJobData(jobId)` → `askJob(JSON.stringify(data), question)` → render
    the plain-text answer with its cited breaker/note source; loading + error states.
- Cross-links: tapping a search result scrolls/highlights the tile or note.

Exit: search "kitchen ring" surfaces the tile + note; free-text questions get cited answers.

## Phase 6 — Polish, PWA, mobile, demo prep (~2 h+)

Goal: demo-proof it.

- Design pass with the light/clean direction: typography scale, spacing, the before/after
  composition, empty states for every list, consistent toasts.
- PWA basics: manifest + icons (installability is nice-to-have; loading in the browser is
  what the demo needs). Vite PWA plugin only if time allows.
- iPhone Chrome over HTTPS (tunnel or Vultr deploy): verify photo capture via file input,
  mic permission on user gesture, layout at 390px width.
- Build the real demo job end-to-end with an actual panel photo; fix the top 3 demo-breakers;
  pre-cache/pre-run every model call on the demo path; record a backup take.

---

## Order of risk (why the phases are sequenced this way)

Phase 1 first because it de-risks the two scariest things at once — camera capture and vision
parse quality — and forces the fallback decision early, per the build doc's H1 gate. Voice
(Phase 3) before materials (Phase 4) because materials reuses the recorder + STT pipeline
built in Phase 3. Retrieval last among features because it's pure read-path over data the
earlier phases create.
