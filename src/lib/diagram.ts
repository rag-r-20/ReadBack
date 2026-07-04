// Pure layout logic: panel components → tile positions + standalone SVG string.
// No React, no DOM — Person A's PanelDiagram component can reuse layoutPanel()
// and TYPE_STYLES, while renderPanelSvg() gives a complete render on its own.

import type { ComponentType, PanelComponent, VisionComponent, VisionParse } from './types';

/** Accepts stored tiles or raw vision-parse components interchangeably. */
export type DiagramComponent = PanelComponent | VisionComponent;

export interface DiagramInput {
  components: DiagramComponent[];
  /** Physical rows on the board; defaults to 1. May be a string from legacy storage. */
  rows?: number | string | null;
  /** Modules per row in the widest tier. May be a string from legacy storage. */
  cols?: number | string | null;
  /** Optional title drawn above the board (e.g. job name). */
  title?: string;
}

export interface TileLayout {
  component: PanelComponent;
  x: number;
  y: number;
  width: number;
  height: number;
  row: number;
}

export interface PanelLayout {
  width: number;
  height: number;
  rows: number;
  /** Uniform modules-per-row used for drag slots and grid fallback. */
  cols: number;
  tiles: TileLayout[];
  /** Vertical offset where tiles start (below the optional title). */
  headerHeight: number;
}

export const TILE = {
  width: 92,
  height: 132,
  gap: 10,
  padding: 26,
  rowGap: 26,
  titleHeight: 34,
};

export interface TypeStyle {
  fill: string;
  stroke: string;
  accent: string;
  caption: string;
  dashed?: boolean;
}

export const TYPE_STYLES: Record<ComponentType, TypeStyle> = {
  main_switch: { fill: '#fdeaea', stroke: '#b91c1c', accent: '#b91c1c', caption: 'MAIN' },
  RCD: { fill: '#fdf4dc', stroke: '#b45309', accent: '#b45309', caption: 'RCD' },
  RCBO: { fill: '#def7f0', stroke: '#0f766e', accent: '#0f766e', caption: 'RCBO' },
  MCB: { fill: '#e4edfc', stroke: '#1d4ed8', accent: '#1d4ed8', caption: 'MCB' },
  blank: { fill: '#f4f4f5', stroke: '#a1a1aa', accent: '#a1a1aa', caption: '', dashed: true },
  other: { fill: '#f1eafb', stroke: '#7c3aed', accent: '#7c3aed', caption: '?' },
};

/** Normalize a VisionComponent to the PanelComponent shape used for layout. */
export function toPanelComponent(c: DiagramComponent): PanelComponent {
  if ('printed_label' in c) {
    return {
      id: c.id,
      order: c.order,
      row: c.row,
      col: c.col,
      type: c.type,
      rating: c.rating,
      purposeLabel: c.printed_label,
      noteIds: [],
      confidence: c.confidence,
    };
  }
  return c;
}

/** Physical rows a domestic consumer unit realistically has. */
export const MAX_PANEL_ROWS = 4;

/** Max rendered height for interactive/static panel SVGs in the UI. */
export const DIAGRAM_MAX_HEIGHT = 520;

/** Min rendered width so tall aspect ratios never collapse to a blank sliver. */
export const DIAGRAM_MIN_WIDTH = 280;

/**
 * Sanitize a rows value from storage or a vision parse so the layout never
 * degenerates: non-numeric/non-finite/out-of-range values fall back to 1 (the
 * pre-rows auto-wrap behavior), and rows is capped both by the component
 * count and by MAX_PANEL_ROWS (a bogus value like the board's way-count would
 * otherwise render a uselessly tall single-column sliver).
 *
 * Accepts legacy IndexedDB values that may have been stored as strings.
 */
export function clampRows(
  rows: number | string | null | undefined,
  componentCount: number,
): number {
  const n = Math.floor(Number(rows));
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, Math.max(1, componentCount), MAX_PANEL_ROWS);
}

/**
 * Sanitize cols from storage or vision parse. Falls back to spreading components
 * evenly across the given row count.
 */
export function clampCols(
  cols: number | string | null | undefined,
  componentCount: number,
  rows: number,
): number {
  const r = clampRows(rows, componentCount);
  const n = Math.floor(Number(cols));
  if (Number.isFinite(n) && n >= 1) {
    return Math.min(n, Math.max(1, componentCount));
  }
  return Math.max(1, Math.ceil(componentCount / r));
}

/** Derive rows/cols from a vision parse, preferring cols and ways over bad row counts. */
export function inferGridFromVision(parse: VisionParse): { rows: number; cols: number } {
  const n = parse.components.length;
  const rows = clampRows(parse.panel.rows, n);
  const ways = parse.panel.ways;
  let cols = clampCols(parse.panel.cols, n, rows);
  if (parse.panel.cols == null && ways != null && ways >= 1) {
    cols = clampCols(Math.round(ways / rows), n, rows);
  }
  return { rows, cols };
}

/** Assign row/col/order from left-to-right top-to-bottom grid positions. */
export function syncComponentGrid(
  components: PanelComponent[],
  rows: number,
  cols: number,
): PanelComponent[] {
  const sorted = [...components].sort((a, b) => a.order - b.order);
  const r = clampRows(rows, sorted.length);
  const c = clampCols(cols, sorted.length, r);
  return sorted.map((comp, i) => ({
    ...comp,
    order: i + 1,
    row: Math.floor(i / c) + 1,
    col: (i % c) + 1,
  }));
}

/** Sort key for layout: explicit row/col when present, else order. */
function layoutSortKey(c: PanelComponent): number {
  if (c.row != null && c.col != null) return (c.row - 1) * 10_000 + (c.col - 1);
  return (c.order - 1) * 10_000;
}

/**
 * Pixel size for displaying a panel SVG with contain-style scaling: honor
 * max height, but never shrink below min width (wrapper may scroll horizontally).
 */
export function diagramDisplaySize(
  layoutWidth: number,
  layoutHeight: number,
): { width: number; height: number } {
  const aspect = layoutWidth / layoutHeight;
  let height = DIAGRAM_MAX_HEIGHT;
  let width = height * aspect;
  if (width < DIAGRAM_MIN_WIDTH) {
    width = DIAGRAM_MIN_WIDTH;
    height = width / aspect;
  }
  return { width: Math.round(width), height: Math.round(height) };
}

/** Compute tile positions for a panel, honoring row/col grid and physical order. */
export function layoutPanel(input: DiagramInput): PanelLayout {
  const components = input.components
    .map(toPanelComponent)
    .sort((a, b) => layoutSortKey(a) - layoutSortKey(b));
  const n = components.length;
  const headerHeight = input.title ? TILE.titleHeight : 0;

  if (n === 0) {
    return {
      width: TILE.padding * 2 + TILE.width,
      height: TILE.padding * 2 + headerHeight + TILE.height,
      rows: 1,
      cols: 1,
      tiles: [],
      headerHeight,
    };
  }

  const rows = clampRows(input.rows, n);
  const cols = clampCols(input.cols, n, rows);
  const hasExplicitGrid = components.every(
    (c) => c.row != null && c.col != null && c.row >= 1 && c.col >= 1,
  );

  const tiles: TileLayout[] = components.map((component, i) => {
    let row0: number;
    let col0: number;
    if (hasExplicitGrid) {
      row0 = component.row! - 1;
      col0 = component.col! - 1;
    } else {
      row0 = Math.floor(i / cols);
      col0 = i % cols;
    }
    return {
      component,
      row: row0,
      x: TILE.padding + col0 * (TILE.width + TILE.gap),
      y: TILE.padding + headerHeight + row0 * (TILE.height + TILE.rowGap),
      width: TILE.width,
      height: TILE.height,
    };
  });

  const usedRows = hasExplicitGrid
    ? Math.max(...components.map((c) => c.row ?? 1), rows)
    : Math.max(1, Math.ceil(n / cols));
  const usedCols = hasExplicitGrid
    ? Math.max(...components.map((c) => c.col ?? 1), cols)
    : Math.min(cols, n);

  return {
    width: TILE.padding * 2 + usedCols * TILE.width + (usedCols - 1) * TILE.gap,
    height:
      TILE.padding * 2 +
      headerHeight +
      usedRows * TILE.height +
      (usedRows - 1) * TILE.rowGap,
    rows: usedRows,
    cols: usedCols,
    tiles,
    headerHeight,
  };
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1).trimEnd() + '…';
}

/** Split a label into up to `maxLines` word-aware lines of ~`perLine` chars. */
function wrapLabel(label: string, perLine: number, maxLines: number): string[] {
  const words = label.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = (current + ' ' + word).trim();
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

function renderTile(t: TileLayout): string {
  const c = t.component;
  const st = TYPE_STYLES[c.type] ?? TYPE_STYLES.other;
  const cx = t.x + t.width / 2;
  const parts: string[] = [];

  parts.push(
    `<rect x="${t.x}" y="${t.y}" width="${t.width}" height="${t.height}" rx="9" ` +
      `fill="${st.fill}" stroke="${st.stroke}" stroke-width="2"` +
      (st.dashed ? ' stroke-dasharray="6 4"' : '') +
      '/>',
  );

  // Position number, top-left.
  parts.push(
    `<text x="${t.x + 8}" y="${t.y + 17}" font-size="11" fill="#71717a">${c.order}</text>`,
  );

  if (c.type === 'blank') {
    parts.push(
      `<text x="${cx}" y="${t.y + t.height / 2 + 4}" font-size="11" fill="#a1a1aa" ` +
        'text-anchor="middle" font-style="italic">spare</text>',
    );
    return parts.join('\n    ');
  }

  // Type caption pill.
  parts.push(
    `<rect x="${cx - 27}" y="${t.y + 24}" width="54" height="17" rx="8.5" fill="${st.accent}"/>`,
    `<text x="${cx}" y="${t.y + 36}" font-size="10" font-weight="bold" fill="#ffffff" ` +
      `text-anchor="middle" letter-spacing="0.5">${escapeXml(st.caption)}</text>`,
  );

  // Toggle nub — a hint of breaker physicality.
  parts.push(
    `<rect x="${cx - 8}" y="${t.y + 49}" width="16" height="24" rx="3" ` +
      `fill="#ffffff" stroke="${st.stroke}" stroke-width="1.5"/>`,
    `<line x1="${cx - 4}" y1="${t.y + 55}" x2="${cx + 4}" y2="${t.y + 55}" ` +
      `stroke="${st.stroke}" stroke-width="1.5"/>`,
  );

  // Rating, large and central.
  if (c.rating) {
    parts.push(
      `<text x="${cx}" y="${t.y + 94}" font-size="16" font-weight="bold" ` +
        `fill="#18181b" text-anchor="middle">${escapeXml(truncate(c.rating, 8))}</text>`,
    );
  }

  // Purpose label, up to 2 small lines at the bottom.
  if (c.purposeLabel) {
    const lines = wrapLabel(c.purposeLabel, 14, 2);
    lines.forEach((line, i) => {
      parts.push(
        `<text x="${cx}" y="${t.y + 109 + i * 11}" font-size="9" fill="#3f3f46" ` +
          `text-anchor="middle">${escapeXml(line)}</text>`,
      );
    });
  }

  // Low-confidence marker so the user knows to double-check.
  if (c.confidence < 0.5) {
    parts.push(
      `<circle cx="${t.x + t.width - 12}" cy="${t.y + 13}" r="7" fill="#fbbf24"/>`,
      `<text x="${t.x + t.width - 12}" y="${t.y + 17}" font-size="10" ` +
        'fill="#78350f" text-anchor="middle" font-weight="bold">?</text>',
    );
  }

  return parts.join('\n    ');
}

/** Panel → complete standalone SVG document string. */
export function renderPanelSvg(input: DiagramInput): string {
  const layout = layoutPanel(input);
  const tiles = layout.tiles.map(renderTile).join('\n    ');
  const title = input.title
    ? `<text x="${TILE.padding}" y="${TILE.padding + 16}" font-size="15" font-weight="bold" fill="#18181b">${escapeXml(truncate(input.title, 60))}</text>\n  `
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}" font-family="system-ui, -apple-system, sans-serif">
  <rect x="4" y="4" width="${layout.width - 8}" height="${layout.height - 8}" rx="14" fill="#fafafa" stroke="#d4d4d8" stroke-width="2"/>
  ${title}<g>
    ${tiles}
  </g>
</svg>
`;
}
