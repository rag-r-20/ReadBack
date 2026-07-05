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
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [address, setAddress] = useState("");

  const refresh = useCallback(async () => {
    setJobs(await listJobs());
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleCreate(e?: { preventDefault?: () => void }) {
    e?.preventDefault?.();
    const t = title.trim();
    if (!t) {
      toast.error("Give the job a name or address.");
      return;
    }
    if (saving) return;
    setSaving(true);
    try {
      const job = await createJob(t, address.trim() || undefined);
      setCreating(false);
      setTitle("");
      setAddress("");
      navigate(`/job/${job.id}/capture`);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Could not save the job — try turning off private browsing.",
      );
    } finally {
      setSaving(false);
    }
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
          <div className="flex items-center gap-3">
            <span className="text-body-md text-[var(--color-on-surface-variant)]">test_user</span>
            <Button size="sm" onClick={() => setCreating(true)}>
              + New job
            </Button>
          </div>
        }
      />

      <main className="flex-1 px-4 py-4">
        {loading ? (
          <p className="py-16 text-center text-body-md text-[var(--color-on-surface-variant)]">Loading…</p>
        ) : jobs.length === 0 ? (
          <EmptyState onNew={() => setCreating(true)} />
        ) : (
          <ul className="flex flex-col gap-3">
            {jobs.map((job) => (
              <li key={job.id}>
                <Card
                  className="flex cursor-pointer items-center gap-3 p-4 transition-colors hover:border-[var(--color-primary)]"
                  onClick={() => navigate(`/job/${job.id}`)}
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-[var(--color-surface-container)] text-[var(--color-primary)]">
                    <PanelIcon />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body-lg font-bold text-[var(--color-on-surface)]">
                      {job.title}
                    </p>
                    {job.address && (
                      <p className="truncate text-body-md text-[var(--color-on-surface-variant)]">
                        {job.address}
                      </p>
                    )}
                    <p className="text-body-md text-[var(--color-outline)]">
                      {new Date(job.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleDelete(job);
                    }}
                    className="min-h-[48px] min-w-[48px] flex items-center justify-center rounded p-2 text-[var(--color-outline)] hover:bg-[var(--color-status-live)]/10 hover:text-[var(--color-status-live)]"
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
        onClose={() => !saving && setCreating(false)}
        title="New job"
        footer={
          <Button
            type="submit"
            form="new-job-form"
            size="lg"
            block
            disabled={saving}
          >
            {saving ? "Creating…" : "Create & capture board"}
          </Button>
        }
      >
        <form
          id="new-job-form"
          className="flex flex-col gap-4"
          onSubmit={(e) => void handleCreate(e)}
        >
          <label className="flex flex-col gap-2">
            <span className="text-body-md font-bold text-[var(--color-on-surface)]">
              Job name or address
            </span>
            <input
              autoFocus
              enterKeyHint="go"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. 14 Elm Road"
              className="rounded border border-[var(--color-outline-variant)] bg-[var(--color-surface-container-lowest)] px-3 py-2 text-body-lg text-[var(--color-on-surface)] outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] min-h-[48px] placeholder:text-[var(--color-on-surface-variant)]"
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-body-md font-bold text-[var(--color-on-surface)]">
              Address (optional)
            </span>
            <input
              enterKeyHint="go"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Full address"
              className="rounded border border-[var(--color-outline-variant)] bg-[var(--color-surface-container-lowest)] px-3 py-2 text-body-lg text-[var(--color-on-surface)] outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] min-h-[48px] placeholder:text-[var(--color-on-surface-variant)]"
            />
          </label>
        </form>
      </Sheet>
    </>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="mt-16 flex flex-col items-center px-6 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded bg-[var(--color-surface-container)] text-[var(--color-primary)]">
        <PanelIcon size={32} />
      </div>
      <h2 className="text-headline-md text-[var(--color-on-surface)]">No jobs yet</h2>
      <p className="mt-2 max-w-xs text-body-md text-[var(--color-on-surface-variant)]">
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
