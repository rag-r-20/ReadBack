import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-[var(--color-primary-container)] text-white hover:bg-[var(--color-inverse-primary)] active:bg-blue-900 shadow-sm disabled:opacity-50",
  secondary:
    "bg-transparent text-[var(--color-on-surface)] border-2 border-[var(--color-slate-light)] hover:bg-[var(--color-surface-bright)] active:bg-[var(--color-surface-highest)] disabled:opacity-50",
  ghost: "bg-transparent text-[var(--color-on-surface)] hover:bg-[var(--color-surface-bright)] active:bg-[var(--color-surface-highest)]",
  danger:
    "bg-[var(--color-status-live)] text-white hover:bg-red-600 active:bg-red-700 disabled:opacity-50",
};

const SIZES: Record<Size, string> = {
  sm: "text-body-md px-3 py-2 rounded min-h-[48px] gap-2",
  md: "text-body-md px-4 py-2 rounded min-h-[48px] gap-2",
  lg: "text-body-lg px-5 py-3 rounded min-h-[48px] gap-2 font-bold",
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  children: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  block = false,
  className = "",
  children,
  ...rest
}: Props) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center font-medium transition-colors disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${block ? "w-full" : ""} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
