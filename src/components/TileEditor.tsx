import { useState } from "react";
import type { ReactNode } from "react";
import type { ComponentType, Note, PanelComponent } from "../lib/types";
import { addNote } from "../lib/db";
import { transcribeBlob, speak } from "../lib/gradium";
import { cleanNote } from "../lib/llm";
import { Sheet } from "./ui/Sheet";
import { Button } from "./ui/Button";
import { Chip as TechChip } from "./ui/Chip";
import { VoiceRecorder } from "./VoiceRecorder";
import { useToast } from "./ui/Toast";

const REVIEW_CONFIDENCE = 0.7;

const TYPE_CAPTIONS: Record<ComponentType, string> = {
  main_switch: "MAIN",
  RCD: "RCD",
  RCBO: "RCBO",
  MCB: "MCB",
  blank: "BLANK",
  other: "AUX",
};

const TYPES: { value: ComponentType; label: string }[] = [
  { value: "main_switch", label: "Main switch" },
  { value: "RCD", label: "RCD" },
  { value: "RCBO", label: "RCBO" },
  { value: "MCB", label: "MCB" },
  { value: "blank", label: "Blank / spare" },
  { value: "other", label: "Other" },
];

type Pipeline = "idle" | "transcribing" | "cleaning";

interface Props {
  jobId: string;
  tile: PanelComponent;
  notes: Note[];
  canMoveLeft: boolean;
  canMoveRight: boolean;
  onSaveField: (patch: Partial<Omit<PanelComponent, "id">>) => Promise<void>;
  onDelete: () => Promise<void>;
  onMove: (dir: -1 | 1) => Promise<void>;
  onAddAfter: () => Promise<void>;
  onNotesChanged: () => void;
  onClose: () => void;
}

export function TileEditor({
  jobId,
  tile,
  notes,
  canMoveLeft,
  canMoveRight,
  onSaveField,
  onDelete,
  onMove,
  onAddAfter,
  onNotesChanged,
  onClose,
}: Props) {
  const toast = useToast();
  const [rating, setRating] = useState(tile.rating ?? "");
  const [label, setLabel] = useState(tile.purposeLabel ?? "");
  const [pipeline, setPipeline] = useState<Pipeline>("idle");

  async function saveMeta(patch: Partial<Omit<PanelComponent, "id">>) {
    await onSaveField(patch);
  }

  async function handleRecorded(blob: Blob) {
    setPipeline("transcribing");
    const stt = await transcribeBlob(blob);
    if (!stt.ok) {
      setPipeline("idle");
      toast.error(stt.error);
      return;
    }
    setPipeline("cleaning");
    const cleaned = await cleanNote(tile.purposeLabel, tile.rating, stt.transcript);
    if (!cleaned.ok) {
      setPipeline("idle");
      toast.error(cleaned.error);
      return;
    }
    await addNote(jobId, stt.transcript, cleaned.value, { componentId: tile.id });
    setPipeline("idle");
    toast.success("Note saved.");
    onNotesChanged();
    void speak("Note saved.").then((r) => {
      if (!r.ok) return;
      const url = URL.createObjectURL(r.audio);
      const audio = new Audio(url);
      audio.addEventListener("ended", () => URL.revokeObjectURL(url), { once: true });
      void audio.play().catch(() => URL.revokeObjectURL(url));
    });
  }

  return (
    <Sheet open onClose={onClose} title={`Breaker #${tile.order}`}>
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-2">
          <TechChip
            tone={tile.type === "main_switch" ? "safe" : tile.type === "blank" ? "default" : "primary"}
          >
            {TYPE_CAPTIONS[tile.type] ?? "AUX"}
          </TechChip>
          {tile.rating && <TechChip tone="gold">{tile.rating}</TechChip>}
          {tile.type !== "blank" && tile.confidence < REVIEW_CONFIDENCE && (
            <TechChip tone="review">Needs review</TechChip>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="col-span-2 flex flex-col gap-2">
            <span className="text-body-md font-bold text-[var(--color-on-surface)]">Type</span>
            <select
              value={tile.type}
              onChange={(e) =>
                void saveMeta({ type: e.target.value as ComponentType })
              }
              className="rounded border border-[var(--color-outline-variant)] bg-[var(--color-surface-container-lowest)] px-3 py-2 text-body-lg text-[var(--color-on-surface)] outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] min-h-[48px]"
            >
              {TYPES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-body-md font-bold text-[var(--color-on-surface)]">Rating</span>
            <input
              value={rating}
              onChange={(e) => setRating(e.target.value)}
              onBlur={() => void saveMeta({ rating: rating.trim() || null })}
              placeholder="e.g. 32A"
              className="rounded border border-[var(--color-outline-variant)] bg-[var(--color-surface-container-lowest)] px-3 py-2 font-[family-name:var(--font-jetbrains)] text-body-lg text-[var(--color-on-surface)] outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] min-h-[48px]"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-body-md font-bold text-[var(--color-on-surface)]">Label</span>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onBlur={() => void saveMeta({ purposeLabel: label.trim() || null })}
              placeholder="e.g. Kitchen ring"
              className="rounded border border-[var(--color-outline-variant)] bg-[var(--color-surface-container-lowest)] px-3 py-2 text-body-lg text-[var(--color-on-surface)] outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] min-h-[48px]"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={!canMoveLeft}
            onClick={() => void onMove(-1)}
          >
            ← Move
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={!canMoveRight}
            onClick={() => void onMove(1)}
          >
            Move →
          </Button>
          <Button variant="secondary" size="sm" onClick={() => void onAddAfter()}>
            + Add after
          </Button>
          <Button
            variant="danger"
            size="sm"
            className="ml-auto"
            onClick={() => void onDelete()}
          >
            Delete
          </Button>
        </div>

        <div className="border-t border-[var(--color-slate-light)] pt-4">
          <h3 className="mb-3 text-headline-md text-[var(--color-on-surface)]">
            Voice notes
          </h3>

          {notes.length > 0 && (
            <ul className="mb-4 flex flex-col gap-2">
              {notes.map((n) => (
                <NoteCard
                  key={n.id}
                  note={n}
                  tileRating={tile.rating}
                  onApplyRating={(r) => void saveMeta({ rating: r })}
                />
              ))}
            </ul>
          )}

          <div className="rounded border border-[var(--color-slate-light)] bg-[var(--color-slate)] p-4">
            <VoiceRecorder
              onRecorded={handleRecorded}
              busy={pipeline !== "idle"}
              busyLabel={
                pipeline === "transcribing" ? "Transcribing…" : "Cleaning note…"
              }
              idleLabel="Tap and describe this breaker"
            />
          </div>
        </div>
      </div>
    </Sheet>
  );
}

function NoteCard({
  note,
  tileRating,
  onApplyRating,
}: {
  note: Note;
  tileRating: string | null;
  onApplyRating: (rating: string) => void;
}) {
  const c = note.cleaned;
  const rating = c.rating;
  const showApply = rating && rating !== tileRating;
  return (
    <li className="rounded border border-[var(--color-slate-light)] bg-[var(--color-slate)] p-3">
      <p className="text-body-lg font-bold text-[var(--color-on-surface)]">{c.purpose}</p>
      <p className="mt-1 text-body-md text-[var(--color-on-surface-variant)]">{c.note_text}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {c.area_served && <Chip>{c.area_served}</Chip>}
        {c.feeds.map((f, i) => (
          <Chip key={i}>{f}</Chip>
        ))}
        {c.cautions && <Chip warn>⚠ {c.cautions}</Chip>}
      </div>
      {showApply && (
        <button
          onClick={() => onApplyRating(rating!)}
          className="mt-3 text-label-caps text-[var(--color-primary)] hover:underline min-h-[48px]"
        >
          Apply rating “{rating}” to tile
        </button>
      )}
    </li>
  );
}

function Chip({
  children,
  warn,
}: {
  children: ReactNode;
  warn?: boolean;
}) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-technical-sm border ${
        warn ? "bg-[var(--color-status-review)]/10 text-[var(--color-status-review)] border-[var(--color-status-review)]" : "bg-[var(--color-surface-container)] text-[var(--color-on-surface)] border-[var(--color-outline-variant)]"
      }`}
    >
      {children}
    </span>
  );
}
