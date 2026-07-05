import type { ReactNode } from "react";
import type { Note, PanelComponent } from "../lib/types";
import { Card } from "./ui/Card";
import { StatusPill } from "./ui/StatusPill";

interface Props {
  notes: Note[];
  components: PanelComponent[];
  onSelectTile?: (id: string) => void;
  /** Show the passive "AI is listening" hint strip (decorative — only when truly recording). */
  recording?: boolean;
}

export function NotesList({ notes, components, onSelectTile, recording }: Props) {
  const orderOf = (componentId?: string) =>
    components.find((c) => c.id === componentId)?.order;

  return (
    <Card className="ai-hud flex flex-col p-4 sm:p-5">
      <header className="mb-4 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
          <MicIcon />
        </span>
        <h2 className="text-headline-md text-[var(--color-on-surface)]">
          AI Voice Notes
        </h2>
      </header>

      {notes.length === 0 ? (
        <p className="py-10 text-center text-body-md text-[var(--color-outline)]">
          No notes yet. Tap a breaker on the board and describe it out loud.
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {notes.map((n) => {
            const order = orderOf(n.componentId);
            const hasCaution = Boolean(n.cleaned.cautions);
            const fact = n.cleaned.note_text || n.cleaned.purpose;
            const actions: string[] = n.cleaned.cautions
              ? [n.cleaned.cautions]
              : n.cleaned.feeds.map((f) => `Confirm feed: ${f}`);

            return (
              <article key={n.id} className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="mr-auto text-body-lg font-bold text-[var(--color-on-surface)]">
                    {n.cleaned.purpose}
                  </h3>
                  <StatusPill status={hasCaution ? "review" : "safe"}>
                    {hasCaution ? "Review" : "Verified"}
                  </StatusPill>
                  {order !== undefined && (
                    <button
                      onClick={() =>
                        n.componentId && onSelectTile?.(n.componentId)
                      }
                      className="min-h-[48px] rounded bg-[var(--color-surface-container)] px-3 text-label-caps text-[var(--color-primary)] transition-colors hover:bg-[var(--color-surface-bright)]"
                    >
                      Breaker {order}
                    </button>
                  )}
                </div>

                {/* Transcription */}
                <section>
                  <p className="mb-1.5 text-label-caps text-[var(--color-on-surface-variant)]">
                    Transcription
                  </p>
                  <blockquote className="rounded border-l-2 border-[var(--color-primary)]/50 bg-[var(--color-surface-container-lowest)] px-3 py-2.5 text-body-md italic text-[var(--color-on-surface-variant)]">
                    “{n.transcript}”
                  </blockquote>
                </section>

                {/* Structured observations */}
                <section>
                  <p className="mb-1.5 text-label-caps text-[var(--color-on-surface-variant)]">
                    Structured Observations
                  </p>
                  <ul className="flex flex-col gap-2">
                    {fact && (
                      <Observation tone="safe">
                        {fact}
                        {(n.cleaned.rating || n.cleaned.area_served) && (
                          <span className="ml-1.5 font-[family-name:var(--font-jetbrains)] text-[var(--color-on-surface-variant)]">
                            {[n.cleaned.rating, n.cleaned.area_served]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        )}
                      </Observation>
                    )}
                    {n.cleaned.cautions && (
                      <Observation tone="review">
                        {n.cleaned.cautions}
                      </Observation>
                    )}
                  </ul>
                </section>

                {/* Actions required */}
                {actions.length > 0 && (
                  <section>
                    <p className="mb-1.5 text-label-caps text-[var(--color-on-surface-variant)]">
                      Actions Required
                    </p>
                    <ul className="flex flex-col gap-2">
                      {actions.map((a, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 rounded border-l-2 border-[var(--color-primary)] bg-[var(--color-primary)]/5 px-3 py-2 text-body-md text-[var(--color-on-surface)]"
                        >
                          <span className="mt-0.5 shrink-0 text-[var(--color-primary)]">
                            <WrenchIcon />
                          </span>
                          <span>{a}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </article>
            );
          })}
        </div>
      )}

      {recording && (
        <div className="ai-glow mt-5 flex items-center justify-center gap-2 rounded bg-[var(--color-surface-container-lowest)] px-4 py-3 text-body-md text-[var(--color-primary)]">
          <span className="h-2 w-2 animate-rec-pulse rounded-full bg-[var(--color-primary)]" />
          AI is listening… Tap to pause
        </div>
      )}
    </Card>
  );
}

function Observation({
  tone,
  children,
}: {
  tone: "safe" | "review";
  children: ReactNode;
}) {
  const isSafe = tone === "safe";
  return (
    <li className="flex items-start gap-2 text-body-md text-[var(--color-on-surface)]">
      <span
        className={`mt-0.5 shrink-0 ${
          isSafe
            ? "text-[var(--color-status-safe)]"
            : "text-[var(--color-status-review)]"
        }`}
      >
        {isSafe ? <CheckIcon /> : <WarnIcon />}
      </span>
      <span>{children}</span>
    </li>
  );
}

function MicIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
      <path
        d="M6 11a6 6 0 0 0 12 0M12 17v3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M8 12l2.5 2.5L16 9"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function WarnIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 3l9 16H3l9-16z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M12 10v4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="12" cy="16.5" r="1" fill="currentColor" />
    </svg>
  );
}

function WrenchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M14.7 6.3a4 4 0 0 0-5.4 4.9L4 16.5 7.5 20l5.3-5.3a4 4 0 0 0 4.9-5.4l-2.3 2.3-2.1-.6-.6-2.1 2-1.6z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}
