import { useState } from "react";
import type {
  BoardLayoutUpdate,
  BoardVoiceItem,
  CleanedNote,
  Panel,
  PanelComponent,
} from "../lib/types";
import { addNote, replacePanelComponentsRaw } from "../lib/db";
import { transcribeBlob, speak } from "../lib/gradium";
import { parseBoardVoice } from "../lib/llm";
import { stripWakePhrases } from "../lib/speechRecognition";
import { useHandsFreeVoice } from "../hooks/useHandsFreeVoice";
import { Sheet } from "./ui/Sheet";
import { Button } from "./ui/Button";
import { VoiceRecorder } from "./VoiceRecorder";
import { useToast } from "./ui/Toast";

type Pipeline = "idle" | "transcribing" | "parsing" | "applying";

interface Review {
  transcript: string;
  summary: string;
  layout?: BoardLayoutUpdate;
  items: BoardVoiceItem[];
}

interface Props {
  jobId: string;
  panel: Panel;
  components: PanelComponent[];
  /** Called after updates/notes were written so the parent can refresh. */
  onChanged: () => void;
}

function clampGridPos(n: number, max: number): number {
  return Math.max(1, Math.min(Math.floor(n), max));
}

function playSpeakConfirmation(text: string) {
  void speak(text).then((r) => {
    if (!r.ok) return;
    const url = URL.createObjectURL(r.audio);
    const audio = new Audio(url);
    audio.addEventListener("ended", () => URL.revokeObjectURL(url), { once: true });
    void audio.play().catch(() => URL.revokeObjectURL(url));
  });
}

/**
 * Board-level voice note: one free-form recording that may cover several
 * breakers, correct the grid layout, or move tiles. Transcribes, asks the LLM
 * to split/match statements, then shows a review sheet before applying.
 */
export function BoardVoice({ jobId, panel, components, onChanged }: Props) {
  const toast = useToast();
  const [pipeline, setPipeline] = useState<Pipeline>("idle");
  const [review, setReview] = useState<Review | null>(null);

  function tileFor(id: string | null): PanelComponent | undefined {
    return id ? components.find((c) => c.id === id) : undefined;
  }

  async function handleRecorded(blob: Blob) {
    setPipeline("transcribing");
    const stt = await transcribeBlob(blob);
    if (!stt.ok) {
      setPipeline("idle");
      toast.error(stt.error);
      return;
    }

    const transcript = stripWakePhrases(stt.transcript) || stt.transcript;
    setPipeline("parsing");
    const context = {
      layout: { rows: panel.rows ?? 1, cols: panel.cols ?? null },
      components: components.map((c) => ({
        id: c.id,
        order: c.order,
        row: c.row ?? null,
        col: c.col ?? null,
        type: c.type,
        rating: c.rating,
        purposeLabel: c.purposeLabel,
      })),
    };
    const parsed = await parseBoardVoice(JSON.stringify(context), transcript);
    setPipeline("idle");
    if (!parsed.ok) {
      toast.error(parsed.error);
      return;
    }
    const hasLayout =
      parsed.value.layout?.rows != null || parsed.value.layout?.cols != null;
    const hasItems = parsed.value.items.length > 0;
    if (!hasLayout && !hasItems) {
      toast.error("Couldn't find anything actionable in that note.");
      return;
    }
    setReview({
      transcript,
      summary: parsed.value.summary,
      layout: parsed.value.layout,
      items: parsed.value.items,
    });
  }

  const handsFree = useHandsFreeVoice({
    onRecorded: handleRecorded,
    disabled: pipeline !== "idle",
    onError: (msg) => toast.error(msg),
  });

  async function apply() {
    if (!review) return;
    setPipeline("applying");
    const saved = review;

    try {
      let layoutRows = panel.rows ?? 1;
      let layoutCols =
        panel.cols ?? Math.max(1, Math.ceil(components.length / layoutRows));
      if (saved.layout?.rows != null) layoutRows = saved.layout.rows;
      if (saved.layout?.cols != null) layoutCols = saved.layout.cols;

      const next = components.map((c) => ({ ...c }));
      const orderOverrides = new Map<string, number>();

      for (const item of saved.items) {
        if (!item.componentId) continue;
        const idx = next.findIndex((c) => c.id === item.componentId);
        if (idx < 0) continue;
        const tile = next[idx];
        if (item.purposeLabel) tile.purposeLabel = item.purposeLabel;
        if (item.rating) tile.rating = item.rating;
        if (item.row != null) tile.row = clampGridPos(item.row, layoutRows);
        if (item.col != null) tile.col = clampGridPos(item.col, layoutCols);
        if (item.order != null) orderOverrides.set(tile.id, item.order);
      }

      const hasExplicitPositions = saved.items.some(
        (i) => i.componentId && (i.row != null || i.col != null),
      );

      if (orderOverrides.size > 0) {
        next.sort((a, b) => {
          const ao = orderOverrides.get(a.id) ?? a.order;
          const bo = orderOverrides.get(b.id) ?? b.order;
          return ao - bo;
        });
      } else if (hasExplicitPositions) {
        next.sort((a, b) => {
          if ((a.row ?? 0) !== (b.row ?? 0)) return (a.row ?? 0) - (b.row ?? 0);
          return (a.col ?? 0) - (b.col ?? 0);
        });
      }

      // Persist the new sequence before replacePanelComponentsRaw re-sorts.
      next.forEach((tile, i) => {
        tile.order = i + 1;
      });

      await replacePanelComponentsRaw(
        panel.id,
        next,
        { rows: layoutRows, cols: layoutCols },
        { preservePositions: hasExplicitPositions },
      );

      let notes = 0;
      for (const item of saved.items) {
        if (!item.note_text) continue;
        const tile = tileFor(item.componentId);
        const cleaned: CleanedNote = {
          purpose: item.purposeLabel ?? tile?.purposeLabel ?? "General note",
          rating: item.rating ?? tile?.rating ?? null,
          area_served: null,
          feeds: [],
          cautions: null,
          note_text: item.note_text,
        };
        await addNote(jobId, saved.transcript, cleaned, {
          componentId: tile?.id,
        });
        notes += 1;
      }

      setReview(null);

      const parts: string[] = [];
      if (saved.layout?.rows != null || saved.layout?.cols != null) {
        parts.push("layout updated");
      }
      const labelUpdates = saved.items.filter(
        (i) => i.componentId && (i.purposeLabel || i.rating),
      ).length;
      const moves = saved.items.filter(
        (i) => i.componentId && (i.order != null || i.row != null || i.col != null),
      ).length;
      if (labelUpdates) {
        parts.push(`${labelUpdates} tile${labelUpdates === 1 ? "" : "s"} relabelled`);
      }
      if (moves) parts.push(`${moves} tile${moves === 1 ? "" : "s"} moved`);
      if (notes) parts.push(`${notes} note${notes === 1 ? "" : "s"} saved`);
      toast.success(parts.length ? parts.join(", ") + "." : "Applied.");
      onChanged();
      playSpeakConfirmation("Board updated.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't apply those changes.",
      );
    } finally {
      setPipeline("idle");
    }
  }

  return (
    <>
      <div className="mt-3 rounded-2xl bg-zinc-50 p-4">
        <VoiceRecorder
          onRecorded={handleRecorded}
          busy={pipeline !== "idle"}
          busyLabel={
            pipeline === "transcribing"
              ? "Transcribing…"
              : pipeline === "parsing"
                ? "Making sense of it…"
                : "Applying…"
          }
          idleLabel="Describe the board — labels, layout, or moves"
        />
        {handsFree.supported && (
          <div className="mt-3 flex flex-col items-center gap-1 border-t border-zinc-200 pt-3">
            <Button
              variant={handsFree.armed ? "primary" : "secondary"}
              size="sm"
              onClick={handsFree.toggle}
              disabled={pipeline !== "idle"}
            >
              {handsFree.phase === "recording"
                ? `Listening… ${handsFree.seconds}s — say "end note"`
                : handsFree.armed
                  ? 'Hands-free on — say "note" to record'
                  : "Hands-free mode"}
            </Button>
            {handsFree.armed && handsFree.phase !== "recording" && (
              <p className="text-xs text-zinc-500">
                Say &ldquo;note&rdquo; to start, &ldquo;end note&rdquo; to stop
              </p>
            )}
          </div>
        )}
      </div>

      {review && (
        <Sheet open onClose={() => setReview(null)} title="Here's what I understood">
          <div className="flex flex-col gap-4">
            {review.summary && (
              <p className="text-sm text-zinc-600">{review.summary}</p>
            )}

            {(review.layout?.rows != null || review.layout?.cols != null) && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                  Layout
                </p>
                <p className="mt-1">
                  {review.layout?.rows != null && (
                    <span>{review.layout.rows} row{review.layout.rows === 1 ? "" : "s"}</span>
                  )}
                  {review.layout?.rows != null && review.layout?.cols != null && " × "}
                  {review.layout?.cols != null && (
                    <span>{review.layout.cols} column{review.layout.cols === 1 ? "" : "s"}</span>
                  )}
                </p>
              </div>
            )}

            {review.items.length > 0 && (
              <ul className="flex flex-col gap-2">
                {review.items.map((item, i) => {
                  const tile = tileFor(item.componentId);
                  const hasMove =
                    item.order != null || item.row != null || item.col != null;
                  return (
                    <li
                      key={i}
                      className="rounded-xl border border-zinc-200 bg-white p-3"
                    >
                      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                        {tile
                          ? `Breaker ${tile.order}${tile.purposeLabel ? ` — ${tile.purposeLabel}` : ""}`
                          : "Job note (no breaker matched)"}
                      </p>
                      <div className="mt-1.5 flex flex-col gap-1 text-sm text-zinc-800">
                        {tile && item.purposeLabel && (
                          <p>
                            Label →{" "}
                            <span className="font-medium">{item.purposeLabel}</span>
                          </p>
                        )}
                        {tile && item.rating && (
                          <p>
                            Rating → <span className="font-medium">{item.rating}</span>
                          </p>
                        )}
                        {hasMove && (
                          <p>
                            Move →{" "}
                            <span className="font-medium">
                              {item.order != null && `position ${item.order}`}
                              {item.order != null && (item.row != null || item.col != null) && ", "}
                              {item.row != null && `row ${item.row}`}
                              {item.row != null && item.col != null && ", "}
                              {item.col != null && `col ${item.col}`}
                            </span>
                          </p>
                        )}
                        {item.note_text && (
                          <p className="text-zinc-600">&ldquo;{item.note_text}&rdquo;</p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            <p className="text-xs text-zinc-400">Heard: &ldquo;{review.transcript}&rdquo;</p>

            <div className="flex gap-3">
              <Button
                variant="secondary"
                size="lg"
                onClick={() => setReview(null)}
                disabled={pipeline === "applying"}
              >
                Discard
              </Button>
              <Button
                size="lg"
                block
                onClick={() => void apply()}
                disabled={pipeline === "applying"}
              >
                {pipeline === "applying" ? "Applying…" : "Apply to board"}
              </Button>
            </div>
          </div>
        </Sheet>
      )}
    </>
  );
}
