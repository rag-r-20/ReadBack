// TEMPORARY smoke harness (not part of the app): seeds IndexedDB with a job
// and panel, then mounts JobView the same way the real router does. Any
// render error is written into #errors so headless Chrome --dump-dom sees it.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { addPanel, db, newId } from "./lib/db";
import type { Job, PanelComponent } from "./lib/types";
import { JobView } from "./components/JobView";
import { ToastProvider } from "./components/ui/Toast";

const errBox = document.getElementById("errors")!;
function logErr(label: string, err: unknown) {
  errBox.textContent += `\n[${label}] ${err instanceof Error ? err.stack ?? err.message : String(err)}`;
}
window.addEventListener("error", (e) => logErr("window.onerror", e.error ?? e.message));
window.addEventListener("unhandledrejection", (e) => logErr("unhandledrejection", e.reason));

function comp(order: number): PanelComponent {
  return {
    id: `c${order}`,
    order,
    type: order === 1 ? "main_switch" : "MCB",
    rating: "32A",
    purposeLabel: `Circuit ${order}`,
    noteIds: [],
    confidence: 0.9,
  };
}

async function seed(rows: number | undefined): Promise<string> {
  const job: Job = { id: newId(), title: "Harness job", createdAt: Date.now() };
  await db.jobs.add(job);
  // Real code path: addPanel is what CameraCapture/ManualPlacement call.
  await addPanel(
    job.id,
    Array.from({ length: 12 }, (_, i) => comp(i + 1)),
    undefined,
    rows,
  );
  return job.id;
}

async function main() {
  await db.delete();
  await db.open();
  const rowsParam = new URLSearchParams(location.search).get("rows");
  const rows =
    rowsParam === "no" || rowsParam === null ? undefined : Number(rowsParam);
  const jobId = await seed(rows);
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <MemoryRouter initialEntries={[`/job/${jobId}`]}>
        <ToastProvider>
          <Routes>
            <Route path="/job/:jobId" element={<JobView />} />
          </Routes>
        </ToastProvider>
      </MemoryRouter>
    </StrictMode>,
  );
  // Give React a moment, then report whether the SVG board exists.
  setTimeout(() => {
    const svg = document.querySelector<SVGSVGElement>("#root svg");
    const tiles = svg ? svg.querySelectorAll("g").length : 0;
    const box = svg?.getBoundingClientRect();
    const vb = svg?.getAttribute("viewBox");
    errBox.textContent += `\n[RESULT] svg=${Boolean(svg)} tiles=${tiles} viewBox=${vb} boxW=${box?.width.toFixed(0)} boxH=${box?.height.toFixed(0)}`;
    document.title = svg ? "BOARD_OK" : "BOARD_MISSING";
  }, 1500);
}

void main().catch((e) => logErr("main", e));
