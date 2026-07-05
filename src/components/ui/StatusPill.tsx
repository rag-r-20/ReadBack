import type { ReactNode } from "react";

export type Status = "live" | "safe" | "review" | "draft" | "certified";

const STYLES: Record<Status, string> = {
  live: "bg-[var(--color-status-live)]/15 text-[var(--color-status-live)] border border-[var(--color-status-live)]/50",
  safe: "bg-transparent text-[var(--color-status-safe)] border border-[var(--color-status-safe)]",
  certified:
    "bg-transparent text-[var(--color-status-safe)] border border-[var(--color-status-safe)]",
  review:
    "bg-[var(--color-status-review)] text-black border border-[var(--color-status-review)]",
  draft:
    "bg-[var(--color-surface-container-high)] text-[var(--color-on-surface-variant)] border border-[var(--color-outline-variant)]",
};

interface Props {
  status: Status;
  children: ReactNode;
  /** Pulsing dot for "live" states. */
  pulse?: boolean;
  className?: string;
}

/** Traffic-light status pill per DESIGN.md (rounded-xl, high contrast). */
export function StatusPill({ status, children, pulse, className = "" }: Props) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-label-caps ${STYLES[status]} ${className}`}
    >
      {pulse && (
        <span className="h-1.5 w-1.5 rounded-full bg-current animate-rec-pulse" />
      )}
      {children}
    </span>
  );
}
