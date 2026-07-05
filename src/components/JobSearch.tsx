import { useEffect, useMemo, useState } from "react";
import type { Material, Note, PanelComponent } from "../lib/types";
import { assembleJobData } from "../lib/db";
import { askJob } from "../lib/llm";
import { Card } from "./ui/Card";
import { Button } from "./ui/Button";
import { Spinner } from "./ui/Spinner";
import { useToast } from "./ui/Toast";

interface Props {
  jobId: string;
  components: PanelComponent[];
  notes: Note[];
  materials: Material[];
  onHighlight: (ids: Set<string> | null) => void;
  onSelectTile: (id: string) => void;
}

export function JobSearch({
  jobId,
  components,
  notes,
  materials,
  onHighlight,
  onSelectTile,
}: Props) {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);

  const q = query.trim().toLowerCase();

  const results = useMemo(() => {
    if (!q) return null;
    const tiles = components.filter((c) =>
      [c.purposeLabel, c.rating, c.type].some((v) =>
        (v ?? "").toLowerCase().includes(q),
      ),
    );
    const noteHits = notes.filter((n) =>
      [
        n.transcript,
        n.cleaned.purpose,
        n.cleaned.note_text,
        n.cleaned.area_served ?? "",
        n.cleaned.feeds.join(" "),
      ].some((v) => v.toLowerCase().includes(q)),
    );
    const matHits = materials.filter((m) =>
      [m.item, m.spec ?? "", m.notes ?? ""].some((v) =>
        v.toLowerCase().includes(q),
      ),
    );
    return { tiles, noteHits, matHits };
  }, [q, components, notes, materials]);

  useEffect(() => {
    if (!results) {
      onHighlight(null);
      return;
    }
    const ids = new Set(results.tiles.map((t) => t.id));
    results.noteHits.forEach((n) => n.componentId && ids.add(n.componentId));
    onHighlight(ids);
  }, [results, onHighlight]);

  useEffect(() => () => onHighlight(null), [onHighlight]);

  async function handleAsk() {
    const question_ = question.trim();
    if (!question_) return;
    setAsking(true);
    setAnswer(null);
    const data = await assembleJobData(jobId);
    if (!data) {
      setAsking(false);
      toast.error("Could not load this job’s data.");
      return;
    }
    const res = await askJob(JSON.stringify(data), question_);
    setAsking(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setAnswer(res.value);
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <label className="mb-2 block text-body-md font-bold text-[var(--color-on-surface)]">
          Search this job
        </label>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. kitchen ring"
          className="w-full rounded border border-[var(--color-outline-variant)] bg-[var(--color-surface-container-lowest)] px-3 py-2 text-body-lg text-[var(--color-on-surface)] outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] min-h-[48px]"
        />

        {results && (
          <div className="mt-3 flex flex-col gap-3">
            {results.tiles.length === 0 &&
            results.noteHits.length === 0 &&
            results.matHits.length === 0 ? (
              <p className="text-body-md text-[var(--color-outline)]">No matches.</p>
            ) : (
              <>
                {results.tiles.map((t) => (
                  <ResultRow
                    key={t.id}
                    kind="Breaker"
                    title={`${t.order}. ${t.purposeLabel ?? t.type}`}
                    subtitle={t.rating ?? undefined}
                    onClick={() => onSelectTile(t.id)}
                  />
                ))}
                {results.noteHits.map((n) => (
                  <ResultRow
                    key={n.id}
                    kind="Note"
                    title={n.cleaned.purpose}
                    subtitle={n.cleaned.note_text}
                    onClick={() => n.componentId && onSelectTile(n.componentId)}
                  />
                ))}
                {results.matHits.map((m) => (
                  <ResultRow
                    key={m.id}
                    kind="Material"
                    title={m.item}
                    subtitle={m.spec ?? undefined}
                  />
                ))}
              </>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-[var(--color-slate-light)] pt-5">
        <label className="mb-2 block text-body-md font-bold text-[var(--color-on-surface)]">
          Ask your job
        </label>
        <div className="flex gap-2">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAsk()}
            placeholder="e.g. what rating is the kitchen ring?"
            className="min-w-0 flex-1 rounded border border-[var(--color-outline-variant)] bg-[var(--color-surface-container-lowest)] px-3 py-2 text-body-lg text-[var(--color-on-surface)] outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] min-h-[48px]"
          />
          <Button onClick={handleAsk} disabled={asking}>
            {asking ? <Spinner size={18} /> : "Ask"}
          </Button>
        </div>

        {answer && (
          <Card className="mt-3 whitespace-pre-wrap p-4 text-body-md text-[var(--color-on-surface)] ai-glow ai-hud">
            {answer}
          </Card>
        )}
      </div>
    </div>
  );
}

function ResultRow({
  kind,
  title,
  subtitle,
  onClick,
}: {
  kind: string;
  title: string;
  subtitle?: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className="flex w-full items-start gap-3 rounded border border-[var(--color-slate-light)] bg-[var(--color-surface)] p-3 text-left enabled:hover:border-[var(--color-primary)] disabled:cursor-default"
    >
      <span className="mt-1 rounded-full bg-[var(--color-surface-container)] px-3 py-1 text-label-caps text-[var(--color-on-surface-variant)]">
        {kind}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body-lg font-bold text-[var(--color-on-surface)]">{title}</span>
        {subtitle && (
          <span className="block truncate text-body-md text-[var(--color-on-surface-variant)]">{subtitle}</span>
        )}
      </span>
    </button>
  );
}
