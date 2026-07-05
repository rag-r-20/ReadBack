# ReadBack

_Snap the board, speak the labels, read it back later._

**Built for the RAISE Summit Hackathon's Cursor track.**

## The problem

Electricians lose real time and confidence to a broken documentation workflow. On a job they climb up and down stairs repeatedly just to remember which breaker feeds which part of a house, "document" work by pointing a phone at a wall and reciting materials into a shaky video, and then can't hear that recording over the noise of the supplier's shop — so they guess. Days later they open a circuit board they've already worked on and have no idea what's what. The information exists in their head in the moment; the tools to capture it cleanly, hands-busy and on-site, don't.

## How ReadBack solves it

ReadBack turns a messy board into a clean, labeled diagram you can actually read later. Snap one photo of the consumer unit and AI reads it into a structured, tile-by-tile schematic — no more staring at a wall of identical switches. Then just talk: say "position four is the kitchen ring, thirty-two amp" and the tile updates, with a review-before-apply step and a spoken confirmation so nothing gets lost to background noise. Every note is pinned to the exact breaker it describes, so reopening the job days later shows a board that explains itself. Materials mentioned in the field roll up into one consolidated shopping list across every job, and an Ask-AI search lets you query a job in plain language.

## Feature highlights

- **Photo-to-diagram** — capture a board photo and get a clean, labeled circuit diagram automatically.
- **Describe-a-board** — no photo? Describe the board in plain English and generate the diagram from that.
- **Voice labeling & edits** — relabel breakers, fix ratings, and rearrange the layout by speaking, with a review-before-apply confirmation.
- **Per-breaker notes** — every note is pinned to the exact tile it describes, so context survives to the next visit.
- **Consolidated materials list** — spoken/added materials roll up into one shopping list across all jobs.
- **Ask AI** — search and question a job in plain language.
- **Before / after view** — see the original board photo next to the clean generated diagram.
- **PDF export** — share a readable board summary as a PDF.
- **Offline-first with portable sync** — all data lives on-device; export/import a JSON backup to move between devices, no server required.
- **Light / dark theme** — switch instantly to suit the environment, from a dim basement to bright outdoors.

## Technologies used

- **Cursor** — used to build the entire project end-to-end, from the first commit to the last.
- **Gemini** — the AI reading board photos and descriptions into structured diagrams, and powering the Ask-AI search.
- **Gradium** — voice for the app: speech-to-text for dictating labels and notes, and text-to-speech for spoken confirmations.
- **Stitch** — used to design the interface and overall visual/UX direction.

## Tech stack

- **React + TypeScript** — application UI and logic.
- **Vite** — build tooling and dev server.
- **Tailwind CSS** — styling and theming (including light/dark).
- **React Router** — client-side navigation.
- **Dexie (IndexedDB)** — offline-first local storage.

## Future development

- **Hands-free mode** — fully voice-driven capture so the phone never has to be touched on a ladder.
- **Incremental circuit expansion by voice** — keep talking to progressively map every circuit until the whole property's electricals are captured.
- **Voice-recorded testing for certification** — dictate test results on-site instead of manually transcribing scribbled readings for compliance paperwork.
- **Read-only schematic sharing via QR** — today sharing means exporting a JSON file; next, generate a printable/sendable QR code so the next electrician can open a board instantly.
- **Wholesaler stock integration** — a scraper/API for local suppliers to automatically check whether items are in stock.

## Getting started

### Prerequisites

- Node.js 18+ and npm

### Setup

1. Clone the repo:
   ```bash
   git clone https://github.com/rag-r-20/ReadBack.git
   cd ReadBack
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create your local env file from the template:
   ```bash
   cp .env.example .env.local
   ```
4. Add your API keys to `.env.local`:
   - `VITE_GEMINI_API_KEY` — Google AI Studio key, powers vision parsing + AI text calls ([aistudio.google.com](https://aistudio.google.com))
   - `VITE_GRADIUM_API_KEY` — Gradium key, powers speech-to-text and text-to-speech ([gradium.ai](https://gradium.ai))
5. Start the dev server:
   ```bash
   npm run dev
   ```

### Available scripts

- `npm run dev` — start the Vite dev server
- `npm run build` — type-check and build for production
- `npm run preview` — preview the production build
