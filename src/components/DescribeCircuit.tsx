import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { descriptionParse } from "../lib/llm";
import { addPanel, getJob, visionParseToComponents } from "../lib/db";
import { inferGridFromVision, syncComponentGrid } from "../lib/diagram";
import type { Job, PanelComponent, VisionParse } from "../lib/types";
import { TopBar } from "./TopBar";
import { Button } from "./ui/Button";
import { Spinner } from "./ui/Spinner";
import { useToast } from "./ui/Toast";
import { ManualPlacement } from "./ManualPlacement";

type Stage = "form" | "reading" | "manual";

function gridForCount(count: number): { rows: number; cols: number } {
  const cols = Math.max(1, Math.ceil(Math.sqrt(count)));
  const rows = Math.max(1, Math.ceil(count / cols));
  return { rows, cols };
}

export function DescribeCircuit() {
  const { jobId = "" } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [job, setJob] = useState<Job | null>(null);
  const [stage, setStage] = useState<Stage>("form");
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);

  useEffect(() => {
    void getJob(jobId).then((j) => {
      if (!j) {
        toast.error("That property no longer exists.");
        navigate("/", { replace: true });
      } else {
        setJob(j);
      }
    });
  }, [jobId, navigate, toast]);

  async function finalize(parse: VisionParse) {
    try {
      const { rows, cols } = inferGridFromVision(parse);
      await addPanel(jobId, visionParseToComponents(parse), {
        label: label.trim() || undefined,
        sourceDescription: description.trim(),
        sourceType: "description",
        rows,
        cols,
      });
      toast.success("Circuit render created.");
      navigate(`/job/${jobId}`, { replace: true });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't save that board.",
      );
      setStage("form");
    }
  }

  async function finalizeManual(components: PanelComponent[]) {
    try {
      const { rows, cols } = gridForCount(components.length);
      await addPanel(jobId, syncComponentGrid(components, rows, cols), {
        label: label.trim() || undefined,
        sourceDescription: description.trim(),
        sourceType: "description",
        rows,
        cols,
      });
      toast.success("Circuit render created.");
      navigate(`/job/${jobId}`, { replace: true });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't save that board.",
      );
    }
  }

  async function runDescriptionPipeline() {
    const text = description.trim();
    if (!text) {
      toast.error("Describe the board first.");
      return;
    }
    setStage("reading");
    setParseError(null);
    try {
      const res = await descriptionParse(text);
      if (!res.ok) {
        setParseError(res.error);
        setStage("manual");
        return;
      }
      await finalize(res.value);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't build that board.",
      );
      setStage("form");
    }
  }

  if (stage === "manual") {
    return (
      <ManualPlacement
        reason={parseError}
        cancelLabel="Go back"
        onCancel={() => setStage("form")}
        onConfirm={async (components) => {
          await finalizeManual(components);
        }}
      />
    );
  }

  return (
    <>
      <TopBar
        title="Describe board"
        subtitle={job?.title}
        back
        backTo={`/job/${jobId}`}
      />
      <main className="flex flex-1 flex-col px-4 py-4">
        {stage === "reading" ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
            <Spinner size={40} className="text-[var(--color-primary)]" />
            <div>
              <p className="text-headline-md text-[var(--color-on-surface)]">
                Building your diagram…
              </p>
              <p className="mt-2 text-body-md text-[var(--color-on-surface-variant)]">
                Turning the description into a labeled board layout.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-body-md text-[var(--color-on-surface-variant)]">
              Describe the consumer unit in plain English — breaker order, types,
              ratings, and labels. ReadBack will render a clean diagram without a
              photo.
            </p>
            <label className="flex flex-col gap-2">
              <span className="text-body-md font-bold text-[var(--color-on-surface)]">
                Circuit name (optional)
              </span>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Garage sub-board"
                className="rounded border border-[var(--color-outline-variant)] bg-[var(--color-surface-container-lowest)] px-3 py-2 text-body-lg text-[var(--color-on-surface)] outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] min-h-[48px] placeholder:text-[var(--color-on-surface-variant)]"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-body-md font-bold text-[var(--color-on-surface)]">
                Board description
              </span>
              <textarea
                autoFocus
                rows={8}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={`e.g. 10-way board: 100A main switch, 63A RCD, then kitchen ring 32A, lighting 6A, cooker 32A, shower 40A…`}
                className="resize-y rounded border border-[var(--color-outline-variant)] bg-[var(--color-surface-container-lowest)] px-3 py-2 text-body-lg text-[var(--color-on-surface)] outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] min-h-[48px] placeholder:text-[var(--color-on-surface-variant)]"
              />
            </label>
            <Button
              size="lg"
              block
              onClick={() => void runDescriptionPipeline()}
              disabled={!description.trim()}
            >
              Create render
            </Button>
          </div>
        )}
      </main>
    </>
  );
}
