import { useEffect } from "react";
import type { ReactNode } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  /** Pinned action area — stays visible above the mobile keyboard. */
  footer?: ReactNode;
  /** Max width on desktop; the sheet centers as a dialog there. */
  className?: string;
}

/**
 * Bottom sheet on mobile, centered dialog on desktop. Used for the tile editor,
 * capture prompts, and any modal flow.
 */
export function Sheet({ open, onClose, title, children, footer, className = "" }: Props) {
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
        onClick={(e) => e.stopPropagation()}
        className={`safe-bottom relative flex max-h-[min(92dvh,100%)] w-full flex-col rounded-t-3xl bg-white shadow-2xl sm:max-h-[85vh] sm:w-auto sm:min-w-[420px] sm:max-w-lg sm:rounded-3xl ${className}`}
      >
        {title !== undefined && (
          <div className="flex shrink-0 items-center justify-between border-b border-zinc-100 px-5 py-4">
            <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
            <button
              type="button"
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
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
          {children}
        </div>
        {footer && (
          <div className="shrink-0 border-t border-zinc-100 bg-white px-5 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
