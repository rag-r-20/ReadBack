// Smoke test: canned realistic panel → renderPanelSvg → out/panel-sample.svg
// Run with: npm run test:diagram   (or: npx tsx scripts/test-diagram.ts)

import { mkdirSync, writeFileSync } from 'node:fs';
import {
  clampCols,
  clampRows,
  layoutPanel,
  renderPanelSvg,
  toPanelComponent,
} from '../src/lib/diagram';
import type { PanelComponent, VisionParse } from '../src/lib/types';

const parse: VisionParse = {
  panel: { ways: 12, rows: 2, cols: 6 },
  components: [
    { id: 'c1', order: 1, row: 1, col: 1, type: 'main_switch', rating: '100A', printed_label: 'Main Switch', confidence: 0.97 },
    { id: 'c2', order: 2, row: 1, col: 2, type: 'RCD', rating: '63A', printed_label: 'RCD 1', confidence: 0.9 },
    { id: 'c3', order: 3, row: 1, col: 3, type: 'MCB', rating: 'B32', printed_label: 'Kitchen ring main', confidence: 0.85 },
    { id: 'c4', order: 4, row: 1, col: 4, type: 'MCB', rating: 'B32', printed_label: 'Downstairs sockets', confidence: 0.82 },
    { id: 'c5', order: 5, row: 1, col: 5, type: 'MCB', rating: 'B16', printed_label: 'Immersion heater', confidence: 0.78 },
    { id: 'c6', order: 6, row: 1, col: 6, type: 'RCBO', rating: 'B40', printed_label: 'Electric shower', confidence: 0.88 },
    { id: 'c7', order: 7, row: 2, col: 1, type: 'RCD', rating: '63A', printed_label: 'RCD 2', confidence: 0.91 },
    { id: 'c8', order: 8, row: 2, col: 2, type: 'MCB', rating: 'B6', printed_label: 'Upstairs lights', confidence: 0.8 },
    { id: 'c9', order: 9, row: 2, col: 3, type: 'MCB', rating: 'B6', printed_label: 'Downstairs lights', confidence: 0.76 },
    { id: 'c10', order: 10, row: 2, col: 4, type: 'RCBO', rating: 'B32', printed_label: 'Garage supply and outdoor sockets', confidence: 0.7 },
    { id: 'c11', order: 11, row: 2, col: 5, type: 'other', rating: null, printed_label: null, confidence: 0.35 },
    { id: 'c12', order: 12, row: 2, col: 6, type: 'blank', rating: null, printed_label: null, confidence: 0.95 },
  ],
};

let failed = 0;

const rowChecks: Array<[string, number, number]> = [
  ['undefined → 1', clampRows(undefined, 12), 1],
  ['null → 1', clampRows(null, 12), 1],
  ['NaN → 1', clampRows(Number.NaN, 12), 1],
  ['string "2" → 2', clampRows('2', 12), 2],
  ['string "12" (way-count bug) → 4 cap', clampRows('12', 12), 4],
  ['string "abc" → 1', clampRows('abc', 12), 1],
  ['empty string → 1', clampRows('', 12), 1],
];
for (const [name, got, expect] of rowChecks) {
  const ok = got === expect;
  console.log(`${ok ? 'PASS' : 'FAIL'}  clampRows ${name} (got ${got})`);
  if (!ok) failed++;
}

const colChecks: Array<[string, number, number]> = [
  ['undefined → ceil(12/2)=6', clampCols(undefined, 12, 2), 6],
  ['explicit 6', clampCols(6, 12, 2), 6],
  ['ways bug 12 rows → 6 cols', clampCols(undefined, 12, 2), 6],
];
for (const [name, got, expect] of colChecks) {
  const ok = got === expect;
  console.log(`${ok ? 'PASS' : 'FAIL'}  clampCols ${name} (got ${got})`);
  if (!ok) failed++;
}

const components: PanelComponent[] = parse.components.map(toPanelComponent);
const layout = layoutPanel({ components, rows: 2, cols: 6 });
const row1 = layout.tiles.filter((t) => t.row === 0);
const row2 = layout.tiles.filter((t) => t.row === 1);
const gridChecks: Array<[string, boolean]> = [
  ['layout is 2 rows × 6 cols', layout.rows === 2 && layout.cols === 6],
  ['row 1 has 6 tiles', row1.length === 6],
  ['row 2 has 6 tiles', row2.length === 6],
  ['row 2 starts below row 1', row2[0].y > row1[0].y],
  ['wide board (>400px)', layout.width > 400],
];
for (const [name, ok] of gridChecks) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) failed++;
}

const svg = renderPanelSvg({
  components,
  rows: parse.panel.rows,
  cols: parse.panel.cols,
  title: '14 Elm Road — Consumer Unit',
});

mkdirSync('out', { recursive: true });
writeFileSync('out/panel-sample.svg', svg, 'utf8');

const checks: Array<[string, boolean]> = [
  ['starts with <svg', svg.trimStart().startsWith('<svg')],
  ['ends with </svg>', svg.trimEnd().endsWith('</svg>')],
  ['has 12 tiles (rects with rx="9")', (svg.match(/rx="9"/g) ?? []).length === 12],
  ['no unescaped ampersands', !/&(?!amp;|lt;|gt;|quot;|#)/.test(svg)],
];

for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) failed++;
}
console.log(`\nWrote out/panel-sample.svg (${svg.length} bytes)`);
if (failed > 0) process.exit(1);
