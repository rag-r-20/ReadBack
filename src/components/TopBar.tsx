import { useNavigate } from "react-router-dom";
import type { ReactNode } from "react";

interface Props {
  title: ReactNode;
  subtitle?: string;
  /** Show a back chevron that pops navigation. */
  back?: boolean;
  /** Explicit back target; defaults to browser back. */
  backTo?: string;
  right?: ReactNode;
}

export function TopBar({ title, subtitle, back, backTo, right }: Props) {
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-30 flex min-h-[64px] items-center gap-3 border-b border-[var(--color-slate-light)] bg-[var(--color-surface)]/90 px-4 py-3 backdrop-blur">
      {back && (
        <button
          onClick={() => (backTo ? navigate(backTo) : navigate(-1))}
          className="-ml-1 flex min-h-[48px] min-w-[48px] items-center justify-center rounded p-2 text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-bright)] hover:text-[var(--color-on-surface)]"
          aria-label="Back"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path
              d="M15 5l-7 7 7 7"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-headline-md text-[var(--color-on-surface)]">
          {title}
        </h1>
        {subtitle && (
          <p className="truncate text-body-md text-[var(--color-on-surface-variant)]">{subtitle}</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        {right}
        <button
          onClick={() => {
            const isDark = document.documentElement.classList.contains("dark");
            if (isDark) {
              document.documentElement.classList.remove("dark");
            } else {
              document.documentElement.classList.add("dark");
            }
          }}
          className="flex min-h-[48px] min-w-[48px] items-center justify-center rounded p-2 text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-bright)] hover:text-[var(--color-on-surface)]"
          aria-label="Toggle theme"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="block dark:hidden">
            <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="hidden dark:block">
            <path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </header>
  );
}
