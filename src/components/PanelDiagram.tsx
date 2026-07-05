import { useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { ComponentType, PanelComponent } from "../lib/types";
import { diagramDisplaySize, layoutPanel, TILE } from "../lib/diagram";
import type { TileLayout } from "../lib/diagram";

interface Props {
  components: PanelComponent[];
  rows?: number | string | null;
  cols?: number | string | null;
  title?: string;
  selectedId?: string | null;
  /** Tile ids to emphasize (e.g. search matches). */
  highlightIds?: Set<string>;
  onSelectTile?: (id: string) => void;
  /**
   * Enables drag-and-drop reordering. Called with component ids in the new
   * physical order (position 1..n) after a tile is dropped somewhere new.
   */
  onReorder?: (orderedIds: string[]) => void;
}

interface DragState {
  id: string;
  /** Index into the order-sorted tiles array. */
  index: number;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  /** True once movement passed the threshold — tile follows the pointer. */
  active: boolean;
  /** Offset from the tile's laid-out position, in viewBox units. */
  dx: number;
  dy: number;
  /** Insertion slot 0..n while dragging. */
  dropIndex: number;
}

const DRAG_THRESHOLD_PX = 6;

/** Confidence below this flags a tile as "needs review". */
export const REVIEW_CONFIDENCE = 0.7;

// Industrial-Tech dark palette (SVG can't read CSS vars, so mirror them here).
const MONO = "'JetBrains Mono', ui-monospace, monospace";
const SANS = "Inter, system-ui, -apple-system, sans-serif";
const CARD_FILL = "#17191c";
const CARD_FILL_DIM = "#131518";
const CARD_STROKE = "#3f424a";
const BOARD_STROKE = "#2a2d31";
const SEL = "#4d8eff";
const BLUE = "#4d8eff";
const GREEN = "#22c55e";
const AMBER = "#f59e0b";
const WHITE = "#e2e2e5";
const MUTED = "#8c909f";
const DIM = "#5b5f68";

const CAPTIONS: Record<ComponentType, string> = {
  main_switch: "MAIN",
  RCD: "RCD",
  RCBO: "RCBO",
  MCB: "MCB",
  blank: "BLANK",
  other: "AUX",
};

/** Interactive SVG board — dark Industrial-Tech tiles, drag-to-reorder. */
export function PanelDiagram({
  components,
  rows,
  cols,
  title,
  selectedId,
  highlightIds,
  onSelectTile,
  onReorder,
}: Props) {
  const layout = useMemo(
    () => layoutPanel({ components, rows: rows ?? undefined, cols: cols ?? undefined, title }),
    [components, rows, cols, title],
  );
  const displaySize = useMemo(
    () => diagramDisplaySize(layout.width, layout.height),
    [layout.width, layout.height],
  );
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const suppressClickRef = useRef(false);

  const dimmed = highlightIds !== undefined && highlightIds.size > 0;
  const gridCols = layout.cols;

  /** Client px → viewBox units (the SVG is scaled to fit its box). */
  function toSvgPoint(clientX: number, clientY: number): { x: number; y: number } {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * layout.width,
      y: ((clientY - rect.top) / rect.height) * layout.height,
    };
  }

  /** Pointer position → insertion slot (0..n), honoring the row grid. */
  function slotAt(x: number, y: number): number {
    const n = layout.tiles.length;
    const rowStride = TILE.height + TILE.rowGap;
    const row = clamp(
      Math.floor((y - TILE.padding - layout.headerHeight + TILE.rowGap / 2) / rowStride),
      0,
      layout.rows - 1,
    );
    const tilesInRow = layout.tiles.filter((t) => t.row === row).length;
    const maxCol = row === layout.rows - 1 && tilesInRow < gridCols ? tilesInRow : gridCols;
    const col = clamp(
      Math.round((x - TILE.padding) / (TILE.width + TILE.gap)),
      0,
      maxCol,
    );
    return clamp(row * gridCols + col, 0, n);
  }

  function handlePointerDown(e: ReactPointerEvent<SVGGElement>, index: number) {
    if (!onReorder) return;
    suppressClickRef.current = false;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({
      id: layout.tiles[index].component.id,
      index,
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      active: false,
      dx: 0,
      dy: 0,
      dropIndex: index,
    });
  }

  function handlePointerMove(e: ReactPointerEvent<SVGGElement>) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const movedPx = Math.hypot(
      e.clientX - drag.startClientX,
      e.clientY - drag.startClientY,
    );
    if (!drag.active && movedPx < DRAG_THRESHOLD_PX) return;

    const start = toSvgPoint(drag.startClientX, drag.startClientY);
    const now = toSvgPoint(e.clientX, e.clientY);
    setDrag({
      ...drag,
      active: true,
      dx: now.x - start.x,
      dy: now.y - start.y,
      dropIndex: slotAt(now.x, now.y),
    });
  }

  function handlePointerUp(e: ReactPointerEvent<SVGGElement>) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    if (drag.active) {
      suppressClickRef.current = true;
      const from = drag.index;
      const insert = drag.dropIndex;
      if (insert !== from && insert !== from + 1 && onReorder) {
        const ids = layout.tiles.map((t) => t.component.id);
        const [moved] = ids.splice(from, 1);
        ids.splice(insert > from ? insert - 1 : insert, 0, moved);
        onReorder(ids);
      }
    }
    setDrag(null);
  }

  function handleTileClick(id: string) {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    onSelectTile?.(id);
  }

  const dragging = drag?.active ? drag : null;
  const draggedTile = dragging ? layout.tiles[dragging.index] : null;

  if (components.length === 0) {
    return (
      <div className="flex min-h-[180px] w-full min-w-[280px] items-center justify-center rounded border border-dashed border-[var(--color-outline-variant)] bg-[var(--color-surface-container-lowest)] px-4 py-8 text-center">
        <p className="max-w-xs text-body-md text-[var(--color-on-surface-variant)]">
          No breakers detected — tap Recapture or add manually
        </p>
      </div>
    );
  }

  return (
    <div className="w-full min-w-[280px] overflow-x-auto">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        preserveAspectRatio="xMidYMid meet"
        className="mx-auto block max-w-none shrink-0"
        width={displaySize.width}
        height={displaySize.height}
        fontFamily={SANS}
      >
        <rect
          x={4}
          y={4}
          width={layout.width - 8}
          height={layout.height - 8}
          rx={14}
          fill="none"
          stroke={BOARD_STROKE}
          strokeWidth={1.5}
        />
        {title && (
          <text
            x={TILE.padding}
            y={TILE.padding + 14}
            fontSize={14}
            fontWeight="bold"
            fill={WHITE}
            fontFamily={SANS}
          >
            {truncate(title, 60)}
          </text>
        )}
        {layout.tiles.map((t, i) => (
          // While dragging, the original tile stays mounted (it holds the
          // pointer capture) but fades to a ghost; a copy follows the pointer.
          <Tile
            key={t.component.id}
            tile={t}
            selected={t.component.id === selectedId}
            faded={
              (dimmed && !highlightIds!.has(t.component.id)) ||
              (dragging !== null && i === dragging.index)
            }
            highlighted={dimmed && highlightIds!.has(t.component.id)}
            draggable={Boolean(onReorder)}
            onClick={handleTileClick}
            onPointerDown={(e) => handlePointerDown(e, i)}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          />
        ))}

        {dragging && <DropIndicator layout={layout} slot={dragging.dropIndex} />}

        {dragging && draggedTile && (
          <g
            transform={`translate(${dragging.dx}, ${dragging.dy})`}
            opacity={0.9}
            style={{ pointerEvents: "none" }}
          >
            <Tile
              tile={draggedTile}
              selected
              faded={false}
              highlighted={false}
              draggable={false}
            />
          </g>
        )}
      </svg>
    </div>
  );
}

/** Vertical bar marking where the dragged tile would be inserted. */
function DropIndicator({
  layout,
  slot,
}: {
  layout: ReturnType<typeof layoutPanel>;
  slot: number;
}) {
  const n = layout.tiles.length;
  const gridCols = layout.cols;
  const row = slot >= n ? layout.rows - 1 : Math.floor(slot / gridCols);
  const col = slot >= n ? n - row * gridCols : slot - row * gridCols;
  const x = TILE.padding + col * (TILE.width + TILE.gap) - TILE.gap / 2;
  const y = TILE.padding + layout.headerHeight + row * (TILE.height + TILE.rowGap);
  return (
    <g style={{ pointerEvents: "none" }}>
      <line
        x1={x}
        y1={y - 4}
        x2={x}
        y2={y + TILE.height + 4}
        stroke={SEL}
        strokeWidth={3}
        strokeLinecap="round"
      />
      <circle cx={x} cy={y - 4} r={4} fill={SEL} />
      <circle cx={x} cy={y + TILE.height + 4} r={4} fill={SEL} />
    </g>
  );
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}

function Tile({
  tile,
  selected,
  faded,
  highlighted,
  draggable,
  onClick,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: {
  tile: TileLayout;
  selected: boolean;
  faded: boolean;
  highlighted: boolean;
  draggable: boolean;
  onClick?: (id: string) => void;
  onPointerDown?: (e: ReactPointerEvent<SVGGElement>) => void;
  onPointerMove?: (e: ReactPointerEvent<SVGGElement>) => void;
  onPointerUp?: (e: ReactPointerEvent<SVGGElement>) => void;
}) {
  const c = tile.component;
  const cx = tile.x + tile.width / 2;
  const clickable = Boolean(onClick);
  const hasNote = c.noteIds.length > 0;

  const isBlank = c.type === "blank";
  const isMain = c.type === "main_switch";
  const lowConf = !isBlank && c.confidence < REVIEW_CONFIDENCE;
  const active = selected || highlighted;

  const accent = isMain ? GREEN : lowConf ? AMBER : BLUE;
  const border = active ? SEL : isMain ? GREEN : lowConf ? AMBER : CARD_STROKE;
  const borderW = active ? 3 : isMain || lowConf ? 2 : 1.4;
  const fill = isBlank ? CARD_FILL_DIM : CARD_FILL;
  const caption = CAPTIONS[c.type] ?? "AUX";
  const chipTextColor = lowConf ? "#141618" : "#ffffff";

  return (
    <g
      opacity={faded ? 0.35 : 1}
      style={{
        cursor: draggable ? "grab" : clickable ? "pointer" : "default",
        // Let pointer events drive the drag instead of touch scrolling.
        ...(draggable ? { touchAction: "none" as const } : {}),
      }}
      onClick={() => onClick?.(c.id)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <rect
        x={tile.x}
        y={tile.y}
        width={tile.width}
        height={tile.height}
        rx={9}
        fill={fill}
        stroke={border}
        strokeWidth={borderW}
      />

      {/* Position number, mono, top-left. */}
      <text
        x={tile.x + 9}
        y={tile.y + 18}
        fontSize={11}
        fontFamily={MONO}
        fill={MUTED}
      >
        #{c.order}
      </text>

      {/* Needs-review flag, top-right. */}
      {lowConf && (
        <g>
          <rect
            x={tile.x + tile.width - 26}
            y={tile.y + 8}
            width={18}
            height={13}
            rx={3}
            fill={AMBER}
          />
          <text
            x={tile.x + tile.width - 17}
            y={tile.y + 18}
            fontSize={10}
            fontWeight="bold"
            fill="#141618"
            textAnchor="middle"
            fontFamily={MONO}
          >
            !
          </text>
        </g>
      )}

      {isBlank ? (
        <text
          x={cx}
          y={tile.y + tile.height / 2 + 4}
          fontSize={11}
          fontFamily={MONO}
          fill={DIM}
          textAnchor="middle"
          letterSpacing="1"
        >
          BLANK
        </text>
      ) : (
        <>
          {isMain ? (
            <text
              x={cx}
              y={tile.y + 38}
              fontSize={12}
              fontWeight="bold"
              fontFamily={MONO}
              fill={GREEN}
              textAnchor="middle"
              letterSpacing="0.5"
            >
              MAIN
            </text>
          ) : (
            <>
              <rect
                x={cx - 24}
                y={tile.y + 25}
                width={48}
                height={17}
                rx={8.5}
                fill={accent}
              />
              <text
                x={cx}
                y={tile.y + 37}
                fontSize={10}
                fontWeight="bold"
                fill={chipTextColor}
                textAnchor="middle"
                letterSpacing="0.5"
                fontFamily={MONO}
              >
                {caption}
              </text>
            </>
          )}

          {/* Breaker glyph — a hint of physical hardware. */}
          <rect
            x={cx - 9}
            y={tile.y + 50}
            width={18}
            height={24}
            rx={3}
            fill="#0c0e10"
            stroke={accent}
            strokeWidth={1.4}
          />
          <line
            x1={cx - 4}
            y1={tile.y + 57}
            x2={cx + 4}
            y2={tile.y + 57}
            stroke={accent}
            strokeWidth={1.6}
            strokeLinecap="round"
          />

          {/* Rating, large mono. */}
          {c.rating && (
            <text
              x={cx}
              y={tile.y + 96}
              fontSize={18}
              fontWeight="bold"
              fontFamily={MONO}
              fill={WHITE}
              textAnchor="middle"
            >
              {truncate(c.rating, 8)}
            </text>
          )}

          {/* Purpose label, up to 2 small lines. */}
          {c.purposeLabel &&
            wrapLabel(c.purposeLabel, 15, 2).map((line, i) => (
              <text
                key={i}
                x={cx}
                y={tile.y + 112 + i * 11}
                fontSize={9}
                fontFamily={SANS}
                fill={isMain ? GREEN : MUTED}
                textAnchor="middle"
              >
                {line}
              </text>
            ))}
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
            fontFamily={MONO}
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
