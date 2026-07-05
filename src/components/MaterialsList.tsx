import { useState } from "react";
import type { Material } from "../lib/types";
import { addMaterials, toggleMaterialSourced } from "../lib/db";
import { extractMaterials } from "../lib/llm";
import { transcribeBlob } from "../lib/gradium";
import { Card } from "./ui/Card";
import { Button } from "./ui/Button";
import { Chip } from "./ui/Chip";
import { VoiceRecorder } from "./VoiceRecorder";
import { useToast } from "./ui/Toast";

type Pipeline = "idle" | "transcribing" | "extracting";

interface Props {
  jobId: string;
  materials: Material[];
  onChanged: () => void;
}

/** Extract a breaker curve descriptor (e.g. "B-Curve") from a free-text spec. */
function curveOf(spec: string | null | undefined): string | null {
  const m = spec?.match(/\b([A-D])[-\s]?curve\b/i);
  return m ? `${m[1].toUpperCase()}-Curve` : null;
}

export function MaterialsList({ jobId, materials, onChanged }: Props) {
  const toast = useToast();
  const [pipeline, setPipeline] = useState<Pipeline>("idle");
  const [manualOpen, setManualOpen] = useState(false);
  const [manualItem, setManualItem] = useState("");
  const [manualSpec, setManualSpec] = useState("");

  async function handleRecorded(blob: Blob) {
    setPipeline("transcribing");
    const stt = await transcribeBlob(blob);
    if (!stt.ok) {
      setPipeline("idle");
      toast.error(stt.error);
      return;
    }
    setPipeline("extracting");
    const items = await extractMaterials(stt.transcript);
    if (!items.ok) {
      setPipeline("idle");
      toast.error(items.error);
      return;
    }
    if (items.value.length === 0) {
      setPipeline("idle");
      toast.error("Didn’t catch any materials there.");
      return;
    }
    await addMaterials(jobId, items.value);
    setPipeline("idle");
    toast.success(`Added ${items.value.length} item(s).`);
    onChanged();
  }

  async function addManual() {
    const item = manualItem.trim();
    if (!item) return;
    await addMaterials(jobId, [
      { item, quantity: null, unit: null, spec: manualSpec.trim() || null },
    ]);
    setManualItem("");
    setManualSpec("");
    setManualOpen(false);
    onChanged();
  }

  async function toggle(id: string) {
    await toggleMaterialSourced(id);
    onChanged();
  }

  return (
    <Card className="ai-hud flex flex-col p-4 sm:p-5">
      <header className="mb-4 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
          <ListIcon />
        </span>
        <h2 className="text-headline-md text-[var(--color-on-surface)]">
          Material Extraction
        </h2>
      </header>

      <div className="mb-4 rounded border border-[var(--color-slate-light)] bg-[var(--color-surface-container-lowest)] p-4">
        <VoiceRecorder
          onRecorded={handleRecorded}
          busy={pipeline !== "idle"}
          busyLabel={
            pipeline === "transcribing" ? "Transcribing…" : "Building list…"
          }
          idleLabel="Tap and say what you need"
        />
      </div>

      {materials.length === 0 ? (
        <p className="py-8 text-center text-body-md text-[var(--color-outline)]">
          No materials yet. Say something like “two metres of 6mm twin and earth
          and a spare 32 amp breaker.”
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {materials.map((m) => {
            const curve = curveOf(m.spec);
            const specText =
              m.spec && (!curve || m.spec.trim().toLowerCase() !== curve.toLowerCase())
                ? m.spec
                : null;
            const metaParts = [
              m.quantity != null
                ? `Qty: ${m.quantity}${m.unit ? ` ${m.unit}` : ""}`
                : m.unit ?? null,
              m.notes ? `(${m.notes})` : null,
            ].filter(Boolean);

            return (
              <li key={m.id}>
                <div
                  className={`flex items-start gap-3 rounded border border-[var(--color-slate-light)] bg-[var(--color-surface-container-lowest)] p-3 transition-opacity ${
                    m.sourced ? "opacity-55" : "opacity-100"
                  }`}
                >
                  <button
                    onClick={() => void toggle(m.id)}
                    className={`flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-md border-2 ${
                      m.sourced
                        ? "border-[var(--color-status-safe)] bg-[var(--color-status-safe)] text-white"
                        : "border-[var(--color-outline-variant)] text-transparent hover:border-[var(--color-outline)]"
                    }`}
                    aria-label={m.sourced ? "Mark as needed" : "Mark as sourced"}
                  >
                    <CheckIcon />
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p
                        className={`text-body-lg font-bold text-[var(--color-on-surface)] ${
                          m.sourced ? "line-through" : ""
                        }`}
                      >
                        {m.item}
                      </p>
                      {curve && <Chip tone="gold">{curve}</Chip>}
                      <Chip tone="primary">Auto-added</Chip>
                    </div>
                    {(metaParts.length > 0 || specText) && (
                      <p className="mt-1 font-[family-name:var(--font-jetbrains)] text-technical-sm text-[var(--color-on-surface-variant)]">
                        {[specText, ...metaParts].filter(Boolean).join("  ·  ")}
                      </p>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-4">
        {manualOpen ? (
          <div className="flex flex-col gap-3 rounded border border-[var(--color-slate-light)] bg-[var(--color-surface-container-lowest)] p-4">
            <input
              autoFocus
              value={manualItem}
              onChange={(e) => setManualItem(e.target.value)}
              placeholder="Item (e.g. Twin & earth cable)"
              className="min-h-[48px] rounded border border-[var(--color-outline-variant)] bg-[var(--color-surface-container-lowest)] px-3 py-2 text-body-lg text-[var(--color-on-surface)] outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
            />
            <input
              value={manualSpec}
              onChange={(e) => setManualSpec(e.target.value)}
              placeholder="Spec (optional, e.g. 6mm²)"
              className="min-h-[48px] rounded border border-[var(--color-outline-variant)] bg-[var(--color-surface-container-lowest)] px-3 py-2 text-body-lg text-[var(--color-on-surface)] outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
            />
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="lg"
                onClick={() => setManualOpen(false)}
              >
                Cancel
              </Button>
              <Button size="lg" block onClick={addManual}>
                Add item
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="secondary" block onClick={() => setManualOpen(true)}>
            + Add item manually
          </Button>
        )}
      </div>
    </Card>
  );
}

function ListIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path
        d="M5 12l5 5L19 7"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
