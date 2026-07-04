// Smoke test: canned realistic panel → renderPanelSvg → out/panel-sample.svg
// Run with: npm run test:diagram   (or: npx tsx scripts/test-diagram.ts)

import { mkdirSync, writeFileSync } from 'node:fs';
import { renderPanelSvg } from '../src/lib/diagram';
import type { VisionParse } from '../src/lib/types';
import { toPanelComponent } from '../src/lib/diagram';

// Mimics a real vision-parse result for a 12-way domestic board, 2 rows.
const parse: VisionParse = {
  panel: { ways: 12, rows: 2 },
  components: [
    { id: 'c1', order: 1, type: 'main_switch', rating: '100A', printed_label: 'Main Switch', confidence: 0.97 },
    { id: 'c2', order: 2, type: 'RCD', rating: '63A', printed_label: 'RCD 1', confidence: 0.9 },
    { id: 'c3', order: 3, type: 'MCB', rating: 'B32', printed_label: 'Kitchen ring main', confidence: 0.85 },
    { id: 'c4', order: 4, type: 'MCB', rating: 'B32', printed_label: 'Downstairs sockets', confidence: 0.82 },
    { id: 'c5', order: 5, type: 'MCB', rating: 'B16', printed_label: 'Immersion heater', confidence: 0.78 },
    { id: 'c6', order: 6, type: 'RCBO', rating: 'B40', printed_label: 'Electric shower', confidence: 0.88 },
    { id: 'c7', order: 7, type: 'RCD', rating: '63A', printed_label: 'RCD 2', confidence: 0.91 },
    { id: 'c8', order: 8, type: 'MCB', rating: 'B6', printed_label: 'Upstairs lights', confidence: 0.8 },
    { id: 'c9', order: 9, type: 'MCB', rating: 'B6', printed_label: 'Downstairs lights', confidence: 0.76 },
    { id: 'c10', order: 10, type: 'RCBO', rating: 'B32', printed_label: 'Garage supply and outdoor sockets', confidence: 0.7 },
    { id: 'c11', order: 11, type: 'other', rating: null, printed_label: null, confidence: 0.35 },
    { id: 'c12', order: 12, type: 'blank', rating: null, printed_label: null, confidence: 0.95 },
  ],
};

const svg = renderPanelSvg({
  components: parse.components.map(toPanelComponent),
  rows: parse.panel.rows,
  title: '14 Elm Road — Consumer Unit',
});

mkdirSync('out', { recursive: true });
writeFileSync('out/panel-sample.svg', svg, 'utf8');

// Cheap well-formedness checks — no XML parser needed for a smoke test.
const checks: Array<[string, boolean]> = [
  ['starts with <svg', svg.trimStart().startsWith('<svg')],
  ['ends with </svg>', svg.trimEnd().endsWith('</svg>')],
  ['has 12 tiles (rects with rx="9")', (svg.match(/rx="9"/g) ?? []).length === 12],
  ['no unescaped ampersands', !/&(?!amp;|lt;|gt;|quot;|#)/.test(svg)],
];

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) failed++;
}
console.log(`\nWrote out/panel-sample.svg (${svg.length} bytes)`);
if (failed > 0) process.exit(1);
