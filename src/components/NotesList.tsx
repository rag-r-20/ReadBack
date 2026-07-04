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
      <p className="py-12 text-center text-sm text-zinc-400">
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
              <div className="mb-1 flex items-center gap-2">
                <p className="font-medium text-zinc-900">{n.cleaned.purpose}</p>
                {order !== undefined && (
                  <button
                    onClick={() => n.componentId && onSelectTile?.(n.componentId)}
                    className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
                  >
                    Breaker {order}
                  </button>
                )}
              </div>
              <p className="text-sm text-zinc-600">{n.cleaned.note_text}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
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
      className={`rounded-full px-2 py-0.5 text-xs ${
        warn ? "bg-amber-100 text-amber-800" : "bg-zinc-100 text-zinc-600"
      }`}
    >
      {children}
    </span>
  );
}
