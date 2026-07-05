import { useEffect, useMemo, useState } from "react";
import type { PanelComponent } from "../lib/types";
import { getPhoto } from "../lib/db";
import { PanelDiagram, REVIEW_CONFIDENCE } from "./PanelDiagram";
import { Chip } from "./ui/Chip";

interface Props {
  photoId?: string;
  components: PanelComponent[];
  rows?: number | string | null;
  cols?: number | string | null;
  title?: string;
  selectedId?: string | null;
  highlightIds?: Set<string>;
  onSelectTile?: (id: string) => void;
  onReorder?: (orderedIds: string[]) => void;
  /** Optional mono subtitle for the AFTER card (e.g. board designation). */
  boardCode?: string;
}

/** Turn a board name into a mono technical designation. */
function boardDesignation(title?: string): string {
  const base = (title ?? "distribution board")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 22);
  return `${base || "DISTRIBUTION_BOARD"}_01`;
}

/** The demo money shot: chaotic photo on the left, tidy diagram on the right. */
export function BeforeAfter({
  photoId,
  components,
  rows,
  cols,
  title,
  selectedId,
  highlightIds,
  onSelectTile,
  onReorder,
  boardCode,
}: Props) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    let url: string | null = null;
    let active = true;
    if (photoId) {
      void getPhoto(photoId).then((blob) => {
        if (blob && active) {
          url = URL.createObjectURL(blob);
          setPhotoUrl(url);
        }
      });
    }
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [photoId]);

  const stats = useMemo(() => {
    const live = components.filter((c) => c.type !== "blank");
    const review = live.filter((c) => c.confidence < REVIEW_CONFIDENCE).length;
    const avg =
      live.length > 0
        ? live.reduce((sum, c) => sum + (c.confidence ?? 0), 0) / live.length
        : 1;
    const main = components.find((c) => c.type === "main_switch");
    return {
      circuits: live.length,
      review,
      confidence: Math.round(avg * 100),
      rating: main?.rating ?? "100A",
    };
  }, [components]);

  const designation = boardCode ?? boardDesignation(title);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* BEFORE ------------------------------------------------------------ */}
      <figure className="m-0 flex flex-col">
        <figcaption className="mb-2 flex items-center justify-between">
          <span className="text-label-caps text-[var(--color-on-surface-variant)]">
            Before
          </span>
          <Chip tone="default">{photoUrl ? "RAW_SCAN.JPG" : "NO_SOURCE"}</Chip>
        </figcaption>
        <div className="flex min-h-[220px] flex-1 items-center justify-center overflow-hidden rounded-lg border border-[var(--color-slate-light)] bg-black">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt="Original board photo"
              className="max-h-72 w-auto object-contain lg:max-h-[520px]"
            />
          ) : (
            <p className="px-6 py-12 text-center text-body-md text-[var(--color-on-surface-variant)]">
              No source photo — this board was described in plain English.
            </p>
          )}
        </div>
      </figure>

      {/* AFTER ------------------------------------------------------------- */}
      <figure className="m-0 flex flex-col">
        <figcaption className="mb-2 flex items-center justify-between">
          <span className="flex items-center gap-2 text-label-caps text-[var(--color-primary)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-primary)] animate-rec-pulse" />
            After (AI Optimized)
          </span>
          <span className="inline-flex items-center rounded border border-[var(--color-primary)]/50 bg-[var(--color-primary)]/15 px-2 py-0.5 text-technical-sm text-[var(--color-primary)]">
            {stats.confidence}% CONFIDENCE
          </span>
        </figcaption>

        <div className="ai-glow flex flex-1 flex-col rounded-lg border border-[var(--color-slate-light)] bg-[var(--color-slate)]">
          <div className="flex items-start justify-between gap-3 border-b border-[var(--color-slate-light)] px-4 py-3">
            <div className="min-w-0">
              <h3 className="truncate text-headline-md text-[var(--color-on-surface)]">
                {title ?? "Board"}
              </h3>
              <p className="mt-0.5 truncate text-technical-sm text-[var(--color-on-surface-variant)]">
                {designation}
              </p>
            </div>
            <div className="shrink-0 text-right leading-tight">
              <p className="text-technical-sm text-[var(--color-on-surface-variant)]">
                SYS_TYPE: <span className="text-[var(--color-on-surface)]">TN-C-S</span>
              </p>
              <p className="mt-0.5 text-technical-sm text-[var(--color-on-surface-variant)]">
                RATING: <span className="text-[var(--color-dewalt-gold)]">{stats.rating}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-1 items-center justify-center p-3">
            <PanelDiagram
              components={components}
              rows={rows}
              cols={cols}
              selectedId={selectedId}
              highlightIds={highlightIds}
              onSelectTile={onSelectTile}
              onReorder={onReorder}
            />
          </div>

          {/* Footer status strip */}
          <div className="flex items-center justify-between gap-3 border-t border-[var(--color-slate-light)] px-4 py-2.5">
            <p className="flex items-center gap-2 text-technical-sm text-[var(--color-on-surface-variant)]">
              <InfoIcon />
              <span>
                {stats.circuits} circuit{stats.circuits === 1 ? "" : "s"} identified.
                {stats.review > 0
                  ? ` ${stats.review} require${stats.review === 1 ? "s" : ""} review.`
                  : " All confirmed."}
              </span>
            </p>
            <span className="shrink-0 text-technical-sm text-[var(--color-outline)]">
              MODEL: OMEGA-7_VISION
            </span>
          </div>
        </div>
      </figure>
    </div>
  );
}

function InfoIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      className="shrink-0 text-[var(--color-primary)]"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path
        d="M12 11v5M12 8h.01"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
