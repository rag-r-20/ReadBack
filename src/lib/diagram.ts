// Pure layout logic: panel components → tile positions + standalone SVG string.
// No React, no DOM — Person A's PanelDiagram component can reuse layoutPanel()
// and TYPE_STYLES, while renderPanelSvg() gives a complete render on its own.

import type { ComponentType, PanelComponent, VisionComponent } from './types';

/** Accepts stored tiles or raw vision-parse components interchangeably. */
export type DiagramComponent = PanelComponent | VisionComponent;

export interface DiagramInput {
  components: DiagramComponent[];
  /** Physical rows on the board; defaults to 1. */
  rows?: number;
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
      type: c.type,
      rating: c.rating,
      purposeLabel: c.printed_label,
      noteIds: [],
      confidence: c.confidence,
    };
  }
  return c;
}

/** Compute tile positions for a panel, honoring row count and physical order. */
export function layoutPanel(input: DiagramInput): PanelLayout {
  const components = input.components
    .map(toPanelComponent)
    .sort((a, b) => a.order - b.order);
  const rows = Math.max(1, input.rows ?? 1);
  const perRow = Math.ceil(components.length / rows) || 1;
  const headerHeight = input.title ? TILE.titleHeight : 0;

  const tiles: TileLayout[] = components.map((component, i) => {
    const row = Math.floor(i / perRow);
    const col = i % perRow;
    return {
      component,
      row,
      x: TILE.padding + col * (TILE.width + TILE.gap),
      y: TILE.padding + headerHeight + row * (TILE.height + TILE.rowGap),
      width: TILE.width,
      height: TILE.height,
    };
  });

  const cols = Math.min(perRow, components.length) || 1;
  const usedRows = Math.max(1, Math.ceil(components.length / perRow));
  return {
    width: TILE.padding * 2 + cols * TILE.width + (cols - 1) * TILE.gap,
    height:
      TILE.padding * 2 +
      headerHeight +
      usedRows * TILE.height +
      (usedRows - 1) * TILE.rowGap,
    rows: usedRows,
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
