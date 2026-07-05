import type { ReactNode } from "react";
import type { Note, PanelComponent } from "../lib/types";
import { Card } from "./ui/Card";

interface Props {
  notes: Note[];
  components: PanelComponent[];
  onSelectTile?: (id: string) => void;
}

export function NotesList({ notes, components, onSelectTile }: Props) {
  if (notes.length === 0) {
    return (
      <p className="py-12 text-center text-body-md text-[var(--color-outline)]">
        No notes yet. Tap a breaker on the board and describe it out loud.
      </p>
    );
  }

  const orderOf = (componentId?: string) =>
    components.find((c) => c.id === componentId)?.order;

  return (
    <ul className="flex flex-col gap-3">
      {notes.map((n) => {
        const order = orderOf(n.componentId);
        return (
          <li key={n.id}>
            <Card className="p-4">
              <div className="mb-1 flex items-center gap-3">
                <p className="text-body-lg font-bold text-[var(--color-on-surface)]">{n.cleaned.purpose}</p>
                {order !== undefined && (
                  <button
                    onClick={() => n.componentId && onSelectTile?.(n.componentId)}
                    className="rounded-full bg-[var(--color-surface-container)] px-3 py-1 text-label-caps text-[var(--color-primary)] hover:bg-[var(--color-surface-bright)] min-h-[48px]"
                  >
                    Breaker {order}
                  </button>
                )}
              </div>
              <p className="text-body-md text-[var(--color-on-surface-variant)]">{n.cleaned.note_text}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {n.cleaned.rating && <Chip>{n.cleaned.rating}</Chip>}
                {n.cleaned.area_served && <Chip>{n.cleaned.area_served}</Chip>}
                {n.cleaned.feeds.map((f, i) => (
                  <Chip key={i}>{f}</Chip>
                ))}
                {n.cleaned.cautions && (
                  <Chip warn>⚠ {n.cleaned.cautions}</Chip>
                )}
              </div>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}

function Chip({ children, warn }: { children: ReactNode; warn?: boolean }) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-technical-sm border ${
        warn ? "bg-[var(--color-status-review)]/10 text-[var(--color-status-review)] border-[var(--color-status-review)]" : "bg-[var(--color-surface-container)] text-[var(--color-on-surface)] border-[var(--color-outline-variant)]"
      }`}
    >
      {children}
    </span>
  );
}
