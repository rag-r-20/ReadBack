import { useState } from "react";
import type { ReactNode } from "react";
import type { ComponentType, PanelComponent } from "../lib/types";
import { newId } from "../lib/db";
import { TopBar } from "./TopBar";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";

const TYPES: { value: ComponentType; label: string }[] = [
  { value: "main_switch", label: "Main switch" },
  { value: "RCD", label: "RCD" },
  { value: "RCBO", label: "RCBO" },
  { value: "MCB", label: "MCB" },
  { value: "blank", label: "Blank / spare" },
  { value: "other", label: "Other" },
];

interface Draft {
  key: string;
  type: ComponentType;
  rating: string;
  label: string;
}

interface Props {
  photoUrl?: string;
  reason: string | null;
  onCancel: () => void;
  onConfirm: (components: PanelComponent[]) => Promise<void> | void;
  cancelLabel?: string;
}

/** Safety net when the vision parse fails: build tiles by hand over the photo. */
export function ManualPlacement({
  photoUrl,
  reason,
  onCancel,
  onConfirm,
  cancelLabel = "Retake photo",
}: Props) {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [saving, setSaving] = useState(false);

  function addTile(type: ComponentType = "MCB") {
    setDrafts((d) => [...d, { key: newId(), type, rating: "", label: "" }]);
  }

  function update(key: string, patch: Partial<Draft>) {
    setDrafts((d) => d.map((t) => (t.key === key ? { ...t, ...patch } : t)));
  }

  function remove(key: string) {
    setDrafts((d) => d.filter((t) => t.key !== key));
  }

  function move(key: string, dir: -1 | 1) {
    setDrafts((d) => {
      const i = d.findIndex((t) => t.key === key);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= d.length) return d;
      const next = [...d];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  async function confirm() {
    setSaving(true);
    const components: PanelComponent[] = drafts.map((t, i) => ({
      id: newId(),
      order: i + 1,
      type: t.type,
      rating: t.rating.trim() || null,
      purposeLabel: t.label.trim() || null,
      noteIds: [],
      confidence: 1,
    }));
    await onConfirm(components);
    setSaving(false);
  }

  return (
    <>
      <TopBar title="Add tiles by hand" />
      <main className="flex-1 px-4 py-4">
        <Card className="mb-4 border border-[var(--color-status-review)] bg-[var(--color-status-review)]/10 p-4">
          <p className="text-body-md font-bold text-[var(--color-status-review)]">
            Couldn’t auto-read this board
          </p>
          <p className="mt-1 text-body-md text-[var(--color-on-surface-variant)]">
            {reason
              ? `${reason} — add the breakers yourself below; you still get a clean diagram.`
              : "Add the breakers yourself below; you still get a clean diagram."}
          </p>
        </Card>

        <div className="mb-4 overflow-hidden rounded border border-[var(--color-slate-light)] bg-black">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt="Board"
              className="mx-auto max-h-64 w-auto object-contain"
            />
          ) : (
            <p className="px-4 py-8 text-center text-body-md text-[var(--color-on-surface-variant)]">
              No photo — add breakers in order below.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3">
          {drafts.map((t, i) => (
            <Card key={t.key} className="p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-zinc-500">
                  Position {i + 1}
                </span>
                <div className="flex items-center gap-1">
                  <IconBtn label="Move left" onClick={() => move(t.key, -1)}>
                    ←
                  </IconBtn>
                  <IconBtn label="Move right" onClick={() => move(t.key, 1)}>
                    →
                  </IconBtn>
                  <IconBtn label="Remove" onClick={() => remove(t.key)} danger>
                    ✕
                  </IconBtn>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={t.type}
                  onChange={(e) =>
                    update(t.key, { type: e.target.value as ComponentType })
                  }
                  className="rounded border border-[var(--color-outline-variant)] bg-[var(--color-surface-container-lowest)] px-2.5 py-2 text-body-md text-[var(--color-on-surface)] outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] min-h-[48px]"
                >
                  {TYPES.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <input
                  value={t.rating}
                  onChange={(e) => update(t.key, { rating: e.target.value })}
                  placeholder="Rating (e.g. 32A)"
                  className="rounded border border-[var(--color-outline-variant)] bg-[var(--color-surface-container-lowest)] px-2.5 py-2 text-body-md text-[var(--color-on-surface)] outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] min-h-[48px]"
                />
                <input
                  value={t.label}
                  onChange={(e) => update(t.key, { label: e.target.value })}
                  placeholder="Label (optional)"
                  className="col-span-2 rounded border border-[var(--color-outline-variant)] bg-[var(--color-surface-container-lowest)] px-2.5 py-2 text-body-md text-[var(--color-on-surface)] outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] min-h-[48px]"
                />
              </div>
            </Card>
          ))}
        </div>

        <Button
          variant="secondary"
          size="lg"
          block
          className="mt-3"
          onClick={() => addTile()}
        >
          + Add tile
        </Button>
      </main>

      <div className="safe-bottom sticky bottom-0 flex gap-3 border-t border-[var(--color-slate-light)] bg-[var(--color-surface)] p-4">
        <Button variant="ghost" size="lg" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button
          size="lg"
          block
          onClick={confirm}
          disabled={drafts.length === 0 || saving}
        >
          {saving ? "Saving…" : `Save board (${drafts.length})`}
        </Button>
      </div>
    </>
  );
}

function IconBtn({
  children,
  label,
  onClick,
  danger,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      className={`flex h-12 w-12 items-center justify-center rounded border text-body-md ${
        danger
          ? "border-[var(--color-status-live)] text-[var(--color-status-live)] hover:bg-[var(--color-status-live)]/10"
          : "border-[var(--color-slate-light)] text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-bright)]"
      }`}
    >
      {children}
    </button>
  );
}
