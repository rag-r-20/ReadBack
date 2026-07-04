import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Job } from "../lib/types";
import { listJobs, createJob, deleteJob } from "../lib/db";
import { TopBar } from "./TopBar";
import { Card } from "./ui/Card";
import { Button } from "./ui/Button";
import { Sheet } from "./ui/Sheet";
import { useToast } from "./ui/Toast";

export function JobList() {
  const navigate = useNavigate();
  const toast = useToast();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [address, setAddress] = useState("");

  const refresh = useCallback(async () => {
    setJobs(await listJobs());
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleCreate() {
    const t = title.trim();
    if (!t) {
      toast.error("Give the job a name or address.");
      return;
    }
    const job = await createJob(t, address.trim() || undefined);
    setCreating(false);
    setTitle("");
    setAddress("");
    navigate(`/job/${job.id}/capture`);
  }

  async function handleDelete(job: Job) {
    if (!confirm(`Delete "${job.title}" and all its data?`)) return;
    await deleteJob(job.id);
    toast.success("Job deleted.");
    void refresh();
  }

  return (
    <>
      <TopBar
        title="ReadBack"
        subtitle="Your jobs"
        right={
          <Button size="sm" onClick={() => setCreating(true)}>
            + New job
          </Button>
        }
      />

      <main className="flex-1 px-4 py-4">
        {loading ? (
          <p className="py-16 text-center text-sm text-zinc-400">Loading…</p>
        ) : jobs.length === 0 ? (
          <EmptyState onNew={() => setCreating(true)} />
        ) : (
          <ul className="flex flex-col gap-3">
            {jobs.map((job) => (
              <li key={job.id}>
                <Card
                  className="flex cursor-pointer items-center gap-3 p-4 transition-colors hover:border-blue-300"
                  onClick={() => navigate(`/job/${job.id}`)}
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                    <PanelIcon />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-zinc-900">
                      {job.title}
                    </p>
                    {job.address && (
                      <p className="truncate text-sm text-zinc-500">
                        {job.address}
                      </p>
                    )}
                    <p className="text-xs text-zinc-400">
                      {new Date(job.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleDelete(job);
                    }}
                    className="rounded-lg p-2 text-zinc-300 hover:bg-red-50 hover:text-red-500"
                    aria-label="Delete job"
                  >
                    <TrashIcon />
                  </button>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </main>

      <Sheet
        open={creating}
        onClose={() => setCreating(false)}
        title="New job"
      >
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-zinc-700">
              Job name or address
            </span>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="e.g. 14 Elm Road"
              className="rounded-xl border border-zinc-300 px-3 py-2.5 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-zinc-700">
              Address (optional)
            </span>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Full address"
              className="rounded-xl border border-zinc-300 px-3 py-2.5 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <Button size="lg" block onClick={handleCreate}>
            Create &amp; capture board
          </Button>
        </div>
      </Sheet>
    </>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="mt-16 flex flex-col items-center px-6 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
        <PanelIcon size={32} />
      </div>
      <h2 className="text-lg font-semibold text-zinc-900">No jobs yet</h2>
      <p className="mt-1 max-w-xs text-sm text-zinc-500">
        Snap a photo of a consumer unit and ReadBack turns it into a clean,
        labeled board you can read back days later.
      </p>
      <Button size="lg" className="mt-6" onClick={onNew}>
        + New job
      </Button>
    </div>
  );
}

function PanelIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect
        x="3"
        y="4"
        width="18"
        height="16"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M7 8v3M12 8v3M17 8v3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path
        d="M5 7h14M10 7V5h4v2M6 7l1 12h10l1-12"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
