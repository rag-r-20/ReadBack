import type { HTMLAttributes, ReactNode } from "react";

type Tone = "default" | "primary" | "gold" | "safe" | "review" | "live";

const TONES: Record<Tone, string> = {
  default:
    "border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] text-[var(--color-on-surface-variant)]",
  primary:
    "border-[var(--color-primary)]/40 bg-[var(--color-primary)]/10 text-[var(--color-primary)]",
  gold: "border-[var(--color-dewalt-gold)]/40 bg-[var(--color-dewalt-gold)]/10 text-[var(--color-dewalt-gold)]",
  safe: "border-[var(--color-status-safe)]/40 bg-[var(--color-status-safe)]/10 text-[var(--color-status-safe)]",
  review:
    "border-[var(--color-status-review)]/40 bg-[var(--color-status-review)]/15 text-[var(--color-status-review)]",
  live: "border-[var(--color-status-live)]/40 bg-[var(--color-status-live)]/10 text-[var(--color-status-live)]",
};

interface Props extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  children: ReactNode;
}

/** Monospaced technical chip, e.g. "B-CURVE", "RCBO", "RAW_SCAN.JPG". */
export function Chip({ tone = "default", className = "", children, ...rest }: Props) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 font-[family-name:var(--font-jetbrains)] text-[11px] font-semibold uppercase tracking-wide ${TONES[tone]} ${className}`}
      {...rest}
    >
      {children}
    </span>
  );
}
