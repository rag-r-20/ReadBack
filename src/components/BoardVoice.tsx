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

    const parsed = await parseBoardVoice(JSON.stringify(context), stt.transcript);

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

      transcript: stt.transcript,

      summary: parsed.value.summary,

      layout: parsed.value.layout,

      items: parsed.value.items,

    });

  }



  async function apply() {

    if (!review) return;

    setPipeline("applying");



    let layoutRows = panel.rows ?? 1;

    let layoutCols = panel.cols;

    if (review.layout?.rows != null) layoutRows = review.layout.rows;

    if (review.layout?.cols != null) layoutCols = review.layout.cols;



    const next = components.map((c) => ({ ...c }));

    const orderOverrides = new Map<string, number>();



    for (const item of review.items) {

      if (!item.componentId) continue;

      const idx = next.findIndex((c) => c.id === item.componentId);

      if (idx < 0) continue;

      const tile = next[idx];

      if (item.purposeLabel) tile.purposeLabel = item.purposeLabel;

      if (item.rating) tile.rating = item.rating;

      if (item.row != null) tile.row = item.row;

      if (item.col != null) tile.col = item.col;

      if (item.order != null) orderOverrides.set(tile.id, item.order);

    }



    if (orderOverrides.size > 0) {

      next.sort((a, b) => {

        const ao = orderOverrides.get(a.id) ?? a.order;

        const bo = orderOverrides.get(b.id) ?? b.order;

        return ao - bo;

      });

    }



    const hasExplicitPositions = review.items.some(

      (i) => i.componentId && (i.row != null || i.col != null),

    );

    if (hasExplicitPositions && orderOverrides.size === 0) {

      next.sort((a, b) => {

        if ((a.row ?? 0) !== (b.row ?? 0)) return (a.row ?? 0) - (b.row ?? 0);

        return (a.col ?? 0) - (b.col ?? 0);

      });

    }



    await replacePanelComponentsRaw(

      panel.id,

      next,

      { rows: layoutRows, cols: layoutCols },

      { preservePositions: hasExplicitPositions && orderOverrides.size === 0 },

    );



    let notes = 0;

    for (const item of review.items) {

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

      await addNote(jobId, review.transcript, cleaned, {

        componentId: tile?.id,

      });

      notes += 1;

    }



    setPipeline("idle");

    setReview(null);



    const parts: string[] = [];

    if (review.layout?.rows != null || review.layout?.cols != null) {

      parts.push("layout updated");

    }

    const labelUpdates = review.items.filter(

      (i) => i.componentId && (i.purposeLabel || i.rating),

    ).length;

    const moves = review.items.filter(

      (i) => i.componentId && (i.order != null || i.row != null || i.col != null),

    ).length;

    if (labelUpdates) parts.push(`${labelUpdates} tile${labelUpdates === 1 ? "" : "s"} relabelled`);

    if (moves) parts.push(`${moves} tile${moves === 1 ? "" : "s"} moved`);

    if (notes) parts.push(`${notes} note${notes === 1 ? "" : "s"} saved`);

    toast.success(parts.length ? parts.join(", ") + "." : "Applied.");

    onChanged();

    void speak("Board updated.").then((r) => {

      if (r.ok) void new Audio(URL.createObjectURL(r.audio)).play().catch(() => {});

    });

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

                          <p className="text-zinc-600">"{item.note_text}"</p>

                        )}

                      </div>

                    </li>

                  );

                })}

              </ul>

            )}



            <p className="text-xs text-zinc-400">Heard: "{review.transcript}"</p>



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

