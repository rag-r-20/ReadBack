import { useState } from "react";
import type { Material } from "../lib/types";
import { addMaterials, toggleMaterialSourced } from "../lib/db";
import { extractMaterials } from "../lib/llm";
import { transcribeBlob } from "../lib/gradium";
import { Card } from "./ui/Card";
import { Button } from "./ui/Button";
import { VoiceRecorder } from "./VoiceRecorder";
import { useToast } from "./ui/Toast";

type Pipeline = "idle" | "transcribing" | "extracting";

interface Props {
  jobId: string;
  materials: Material[];
  onChanged: () => void;
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
    <div className="flex flex-col gap-4">
      <Card className="p-4">
        <VoiceRecorder
          onRecorded={handleRecorded}
          busy={pipeline !== "idle"}
          busyLabel={
            pipeline === "transcribing" ? "Transcribing…" : "Building list…"
          }
          idleLabel="Tap and say what you need"
        />
      </Card>

      {materials.length === 0 ? (
        <p className="py-8 text-center text-body-md text-[var(--color-outline)]">
          No materials yet. Say something like “two metres of 6mm twin and earth
          and a spare 32 amp breaker.”
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {materials.map((m) => (
            <li key={m.id}>
              <Card
                className={`flex items-center gap-3 p-3 transition-opacity ${m.sourced ? "opacity-60" : "opacity-100"}`}
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
                  <p
                    className={`text-body-lg font-bold text-[var(--color-on-surface)] ${m.sourced ? "line-through" : ""}`}
                  >
                    {m.quantity ? `${m.quantity} ` : ""}
                    {m.unit ? `${m.unit} ` : ""}
                    {m.item}
                  </p>
                  {(m.spec || m.notes) && (
                    <p className="text-body-md text-[var(--color-on-surface-variant)]">
                      {[m.spec, m.notes].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {manualOpen ? (
        <Card className="flex flex-col gap-3 p-4">
          <input
            autoFocus
            value={manualItem}
            onChange={(e) => setManualItem(e.target.value)}
            placeholder="Item (e.g. Twin & earth cable)"
            className="rounded border border-[var(--color-outline-variant)] bg-[var(--color-surface-container-lowest)] px-3 py-2 text-body-lg text-[var(--color-on-surface)] outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] min-h-[48px]"
          />
          <input
            value={manualSpec}
            onChange={(e) => setManualSpec(e.target.value)}
            placeholder="Spec (optional, e.g. 6mm²)"
            className="rounded border border-[var(--color-outline-variant)] bg-[var(--color-surface-container-lowest)] px-3 py-2 text-body-lg text-[var(--color-on-surface)] outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] min-h-[48px]"
          />
          <div className="flex gap-2">
            <Button variant="ghost" size="lg" onClick={() => setManualOpen(false)}>
              Cancel
            </Button>
            <Button size="lg" block onClick={addManual}>
              Add item
            </Button>
          </div>
        </Card>
      ) : (
        <Button variant="secondary" onClick={() => setManualOpen(true)}>
          + Add item manually
        </Button>
      )}
    </div>
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
