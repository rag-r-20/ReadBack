import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Material, Note, PanelComponent } from "../lib/types";
import { assembleJobData } from "../lib/db";
import { askJob } from "../lib/llm";
import { Card } from "./ui/Card";
import { Button } from "./ui/Button";
import { Chip } from "./ui/Chip";
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

interface Exchange {
  question: string;
  answer: string;
}

const SUGGESTIONS = [
  "What rating is the kitchen ring?",
  "Show actions required",
  "List every RCBO on the board",
];

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
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);

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
    if (!question_ || asking) return;
    setAsking(true);
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
    setExchanges((prev) => [...prev, { question: question_, answer: res.value }]);
    setQuestion("");
  }

  function useSuggestion(s: string) {
    setQuestion(s);
    inputRef.current?.focus();
  }

  return (
    <Card className="ai-glow ai-hud flex flex-col p-4 sm:p-5">
      <header className="mb-3 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
          <SparkIcon />
        </span>
        <h2 className="text-headline-md text-[var(--color-on-surface)]">Ask AI</h2>
      </header>

      {/* Live search / job context */}
      <div className="mb-4">
        <label className="mb-1.5 block text-label-caps text-[var(--color-on-surface-variant)]">
          Search this job context
        </label>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. kitchen ring"
          className="min-h-[48px] w-full rounded border border-[var(--color-outline-variant)] bg-[var(--color-surface-container-lowest)] px-3 py-2 text-body-md text-[var(--color-on-surface)] outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
        />
        {results && (
          <div className="mt-2 flex flex-col gap-2">
            {results.tiles.length === 0 &&
            results.noteHits.length === 0 &&
            results.matHits.length === 0 ? (
              <p className="text-body-md text-[var(--color-outline)]">
                No matches.
              </p>
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

      {/* Chat thread */}
      <div className="flex flex-col gap-3">
        <Bubble role="assistant">
          I’ve processed the voice notes and extracted materials. What else do you
          need to know about this job?
        </Bubble>

        {exchanges.map((ex, i) => (
          <div key={i} className="flex flex-col gap-3">
            <Bubble role="user">{ex.question}</Bubble>
            <Bubble role="assistant">{ex.answer}</Bubble>
          </div>
        ))}

        {asking && (
          <Bubble role="assistant">
            <span className="inline-flex items-center gap-2 text-[var(--color-on-surface-variant)]">
              <Spinner size={16} /> Thinking…
            </span>
          </Bubble>
        )}
      </div>

      {/* Suggestion chips */}
      <div className="mt-4 flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => useSuggestion(s)}
            className="rounded-full border border-[var(--color-primary)]/40 bg-[var(--color-primary)]/10 px-3 py-2 text-technical-sm text-[var(--color-primary)] transition-colors hover:bg-[var(--color-primary)]/20"
          >
            {s}
          </button>
        ))}
      </div>

      {/* Input row */}
      <div className="mt-4 flex gap-2">
        <input
          ref={inputRef}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAsk()}
          placeholder="e.g. what rating is the kitchen ring?"
          className="min-h-[48px] min-w-0 flex-1 rounded border border-[var(--color-outline-variant)] bg-[var(--color-surface-container-lowest)] px-3 py-2 text-body-md text-[var(--color-on-surface)] outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
        />
        <Button onClick={handleAsk} disabled={asking || !question.trim()}>
          {asking ? <Spinner size={18} /> : "Ask"}
        </Button>
      </div>
    </Card>
  );
}

function Bubble({
  role,
  children,
}: {
  role: "assistant" | "user";
  children: ReactNode;
}) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3.5 py-2.5 text-body-md ${
          isUser
            ? "bg-[var(--color-primary-container)] text-white"
            : "border border-[var(--color-primary)]/25 bg-[var(--color-surface-container-lowest)] text-[var(--color-on-surface)]"
        }`}
      >
        {children}
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
      className="flex w-full items-start gap-2 rounded border border-[var(--color-slate-light)] bg-[var(--color-surface-container-lowest)] p-2.5 text-left enabled:hover:border-[var(--color-primary)] disabled:cursor-default"
    >
      <Chip tone="default" className="mt-0.5">
        {kind}
      </Chip>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body-md font-bold text-[var(--color-on-surface)]">
          {title}
        </span>
        {subtitle && (
          <span className="block truncate text-body-md text-[var(--color-on-surface-variant)]">
            {subtitle}
          </span>
        )}
      </span>
    </button>
  );
}

function SparkIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 3l1.8 4.9L18.7 9.7l-4.9 1.8L12 16.4l-1.8-4.9L5.3 9.7l4.9-1.8L12 3z"
        fill="currentColor"
      />
      <path d="M19 15l.9 2.4L22.3 18l-2.4.9L19 21l-.9-2.1-2.4-.9 2.4-.6L19 15z" fill="currentColor" />
    </svg>
  );
}
