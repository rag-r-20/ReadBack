// Shared type contract for ReadBack. All three workstreams (llm/prompts,
// gradium, db/diagram/UI) code against these exact names — do not rename.

/** Kind of module in a consumer unit, as identified by the vision parse. */
export type ComponentType =
  | 'main_switch'
  | 'RCD'
  | 'RCBO'
  | 'MCB'
  | 'blank'
  | 'other';

// ---------- LLM response shapes (what the model returns, pre-DB) ----------

/** One module as returned by the vision parse (prompt 1). */
export interface VisionComponent {
  id: string;
  /** Physical position: left-to-right then top-to-bottom, starting at 1. */
  order: number;
  type: ComponentType;
  /** e.g. "32A", "B16", "63A" — null if not legible. */
  rating: string | null;
  /** Text printed on/near the module — null if none. */
  printed_label: string | null;
  /** Model confidence 0..1. */
  confidence: number;
}

/** Full vision-parse response: photo → panel JSON. */
export interface VisionParse {
  panel: { ways: number | null; rows: number };
  components: VisionComponent[];
}

/** Structured note produced by the voice-note → clean-note call (prompt 2). */
export interface CleanedNote {
  purpose: string;
  rating: string | null;
  area_served: string | null;
  feeds: string[];
  cautions: string | null;
  /** 1–2 clean sentences a tradesperson reads at the shop. */
  note_text: string;
}

/** One item from the voice → materials extraction (prompt 3). */
export interface MaterialItem {
  item: string;
  quantity: number | null;
  unit: string | null;
  spec: string | null;
  notes?: string;
}

// ---------- Persisted data model (IndexedDB, see db.ts) ----------

export interface Job {
  id: string;
  title: string;
  address?: string;
  createdAt: number;
}

/** One breaker tile on the panel diagram (post-vision, user-correctable). */
export interface PanelComponent {
  id: string;
  order: number;
  type: ComponentType;
  rating: string | null;
  /** Purpose label shown on the tile, seeded from printed_label. */
  purposeLabel: string | null;
  noteIds: string[];
  confidence: number;
}

export interface Panel {
  id: string;
  jobId: string;
  sourcePhotoId?: string;
  components: PanelComponent[];
  createdAt: number;
}

export interface Note {
  id: string;
  jobId: string;
  /** The tile this note is attached to; absent for job-level notes. */
  componentId?: string;
  transcript: string;
  cleaned: CleanedNote;
  audioRef?: string;
  createdAt: number;
}

export interface Material {
  id: string;
  jobId: string;
  item: string;
  quantity: number | null;
  unit: string | null;
  spec: string | null;
  notes?: string;
  /** Stretch: ticked off once bought at the wholesaler. */
  sourced?: boolean;
  createdAt: number;
}

// ---------- Result wrapper so callers never have to try/catch lib calls ----------

export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; raw?: string };
