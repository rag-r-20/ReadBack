import { useMemo } from "react";
import type { PanelComponent } from "../lib/types";
import { layoutPanel, TYPE_STYLES, TILE } from "../lib/diagram";
import type { TileLayout } from "../lib/diagram";

interface Props {
  components: PanelComponent[];
  rows?: number;
  title?: string;
  selectedId?: string | null;
  /** Tile ids to emphasize (e.g. search matches). */
  highlightIds?: Set<string>;
  onSelectTile?: (id: string) => void;
}

/** Interactive SVG board — same geometry/colors as lib/diagram's static render. */
export function PanelDiagram({
  components,
  rows,
  title,
  selectedId,
  highlightIds,
  onSelectTile,
}: Props) {
  const layout = useMemo(
    () => layoutPanel({ components, rows, title }),
    [components, rows, title],
  );

  const dimmed = highlightIds !== undefined && highlightIds.size > 0;

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        className="mx-auto h-auto w-full max-w-full"
        style={{ maxHeight: 520 }}
        fontFamily="system-ui, -apple-system, sans-serif"
      >
        <rect
          x={4}
          y={4}
          width={layout.width - 8}
          height={layout.height - 8}
          rx={14}
          fill="#fafafa"
          stroke="#d4d4d8"
          strokeWidth={2}
        />
        {title && (
          <text
            x={TILE.padding}
            y={TILE.padding + 16}
            fontSize={15}
            fontWeight="bold"
            fill="#18181b"
          >
            {truncate(title, 60)}
          </text>
        )}
        {layout.tiles.map((t) => (
          <Tile
            key={t.component.id}
            tile={t}
            selected={t.component.id === selectedId}
            faded={dimmed && !highlightIds!.has(t.component.id)}
            highlighted={dimmed && highlightIds!.has(t.component.id)}
            onClick={onSelectTile}
          />
        ))}
      </svg>
    </div>
  );
}

function Tile({
  tile,
  selected,
  faded,
  highlighted,
  onClick,
}: {
  tile: TileLayout;
  selected: boolean;
  faded: boolean;
  highlighted: boolean;
  onClick?: (id: string) => void;
}) {
  const c = tile.component;
  const st = TYPE_STYLES[c.type] ?? TYPE_STYLES.other;
  const cx = tile.x + tile.width / 2;
  const clickable = Boolean(onClick);
  const hasNote = c.noteIds.length > 0;

  return (
    <g
      opacity={faded ? 0.35 : 1}
      style={{ cursor: clickable ? "pointer" : "default" }}
      onClick={() => onClick?.(c.id)}
    >
      <rect
        x={tile.x}
        y={tile.y}
        width={tile.width}
        height={tile.height}
        rx={9}
        fill={st.fill}
        stroke={selected || highlighted ? "#1d4ed8" : st.stroke}
        strokeWidth={selected || highlighted ? 3.5 : 2}
        strokeDasharray={st.dashed ? "6 4" : undefined}
      />

      <text x={tile.x + 8} y={tile.y + 17} fontSize={11} fill="#71717a">
        {c.order}
      </text>

      {c.type === "blank" ? (
        <text
          x={cx}
          y={tile.y + tile.height / 2 + 4}
          fontSize={11}
          fill="#a1a1aa"
          textAnchor="middle"
          fontStyle="italic"
        >
          spare
        </text>
      ) : (
        <>
          <rect
            x={cx - 27}
            y={tile.y + 24}
            width={54}
            height={17}
            rx={8.5}
            fill={st.accent}
          />
          <text
            x={cx}
            y={tile.y + 36}
            fontSize={10}
            fontWeight="bold"
            fill="#ffffff"
            textAnchor="middle"
            letterSpacing="0.5"
          >
            {st.caption}
          </text>

          <rect
            x={cx - 8}
            y={tile.y + 49}
            width={16}
            height={24}
            rx={3}
            fill="#ffffff"
            stroke={st.stroke}
            strokeWidth={1.5}
          />
          <line
            x1={cx - 4}
            y1={tile.y + 55}
            x2={cx + 4}
            y2={tile.y + 55}
            stroke={st.stroke}
            strokeWidth={1.5}
          />

          {c.rating && (
            <text
              x={cx}
              y={tile.y + 94}
              fontSize={16}
              fontWeight="bold"
              fill="#18181b"
              textAnchor="middle"
            >
              {truncate(c.rating, 8)}
            </text>
          )}

          {c.purposeLabel &&
            wrapLabel(c.purposeLabel, 14, 2).map((line, i) => (
              <text
                key={i}
                x={cx}
                y={tile.y + 109 + i * 11}
                fontSize={9}
                fill="#3f3f46"
                textAnchor="middle"
              >
                {line}
              </text>
            ))}
        </>
      )}

      {c.confidence < 0.5 && (
        <>
          <circle cx={tile.x + tile.width - 12} cy={tile.y + 13} r={7} fill="#fbbf24" />
          <text
            x={tile.x + tile.width - 12}
            y={tile.y + 17}
            fontSize={10}
            fill="#78350f"
            textAnchor="middle"
            fontWeight="bold"
          >
            ?
          </text>
        </>
      )}

      {hasNote && (
        <g>
          <circle
            cx={tile.x + 13}
            cy={tile.y + tile.height - 13}
            r={8}
            fill="#0f766e"
          />
          <text
            x={tile.x + 13}
            y={tile.y + tile.height - 9}
            fontSize={9}
            fill="#ffffff"
            textAnchor="middle"
            fontWeight="bold"
          >
            {c.noteIds.length}
          </text>
        </g>
      )}
    </g>
  );
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1).trimEnd() + "…";
}

function wrapLabel(label: string, perLine: number, maxLines: number): string[] {
  const words = label.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = (current + " " + word).trim();
    if (candidate.length <= perLine) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      if (lines.length >= maxLines) break;
      current = word;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  if (lines.length > maxLines) lines.length = maxLines;
  if (lines.length === maxLines && lines[maxLines - 1].length > perLine) {
    lines[maxLines - 1] = truncate(lines[maxLines - 1], perLine);
  }
  return lines.length ? lines : [truncate(label, perLine)];
}
