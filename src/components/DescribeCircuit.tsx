import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { descriptionParse } from "../lib/llm";
import { addPanel, getJob, visionParseToComponents } from "../lib/db";
import { inferGridFromVision } from "../lib/diagram";
import type { Job, PanelComponent, VisionParse } from "../lib/types";
import { TopBar } from "./TopBar";
import { Button } from "./ui/Button";
import { Spinner } from "./ui/Spinner";
import { useToast } from "./ui/Toast";
import { ManualPlacement } from "./ManualPlacement";

type Stage = "form" | "reading" | "manual";

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
  }

  async function runDescriptionPipeline() {
    const text = description.trim();
    if (!text) {
      toast.error("Describe the board first.");
      return;
    }
    setStage("reading");
    setParseError(null);
    const res = await descriptionParse(text);
    if (!res.ok) {
      setParseError(res.error);
      setStage("manual");
      return;
    }
    await finalize(res.value);
  }

  if (stage === "manual") {
    return (
      <ManualPlacement
        reason={parseError}
        cancelLabel="Go back"
        onCancel={() => setStage("form")}
        onConfirm={async (components: PanelComponent[]) => {
          await addPanel(jobId, components, {
            label: label.trim() || undefined,
            sourceDescription: description.trim(),
            sourceType: "description",
          });
          toast.success("Circuit render created.");
          navigate(`/job/${jobId}`, { replace: true });
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
            <Spinner size={40} className="text-blue-700" />
            <div>
              <p className="text-lg font-semibold text-zinc-900">
                Building your diagram…
              </p>
              <p className="mt-1 text-sm text-zinc-500">
                Turning the description into a labeled board layout.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-zinc-500">
              Describe the consumer unit in plain English — breaker order, types,
              ratings, and labels. ReadBack will render a clean diagram without a
              photo.
            </p>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-zinc-700">
                Circuit name (optional)
              </span>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Garage sub-board"
                className="rounded-xl border border-zinc-300 px-3 py-2.5 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-zinc-700">
                Board description
              </span>
              <textarea
                autoFocus
                rows={8}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={`e.g. 10-way board: 100A main switch, 63A RCD, then kitchen ring 32A, lighting 6A, cooker 32A, shower 40A…`}
                className="resize-y rounded-xl border border-zinc-300 px-3 py-2.5 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
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
