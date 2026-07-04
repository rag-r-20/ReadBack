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
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-zinc-200 bg-white/90 px-4 py-3 backdrop-blur">
      {back && (
        <button
          onClick={() => (backTo ? navigate(backTo) : navigate(-1))}
          className="-ml-1 rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
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
        <h1 className="truncate text-lg font-semibold leading-tight text-zinc-900">
          {title}
        </h1>
        {subtitle && (
          <p className="truncate text-xs text-zinc-500">{subtitle}</p>
        )}
      </div>
      {right}
    </header>
  );
}
