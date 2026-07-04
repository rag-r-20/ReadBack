import { useEffect } from "react";
import type { ReactNode } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  /** Max width on desktop; the sheet centers as a dialog there. */
  className?: string;
}

/**
 * Bottom sheet on mobile, centered dialog on desktop. Used for the tile editor,
 * capture prompts, and any modal flow.
 */
export function Sheet({ open, onClose, title, children, className = "" }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        className={`safe-bottom relative w-full rounded-t-3xl bg-white shadow-2xl sm:w-auto sm:min-w-[420px] sm:max-w-lg sm:rounded-3xl ${className}`}
      >
        {title !== undefined && (
          <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
            <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
            <button
              onClick={onClose}
              className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
              aria-label="Close"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path
                  d="M6 6l12 12M18 6L6 18"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        )}
        <div className="max-h-[75vh] overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
