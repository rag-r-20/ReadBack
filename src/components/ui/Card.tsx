import type { HTMLAttributes, ReactNode } from "react";

interface Props extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function Card({ className = "", children, ...rest }: Props) {
  return (
    <div
      className={`rounded border border-[var(--color-slate-light)] bg-[var(--color-slate)] shadow-sm ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
