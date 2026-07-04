// Smoke test: server-render PanelDiagram with old-style (no rows) and
// new-style (rows persisted) data to catch render-time throws.
import { renderToString } from "react-dom/server";
import { PanelDiagram } from "../src/components/PanelDiagram";
import type { PanelComponent } from "../src/lib/types";

function comp(order: number): PanelComponent {
  return {
    id: `c${order}`,
    order,
    type: order === 1 ? "main_switch" : "MCB",
    rating: "32A",
    purposeLabel: "Kitchen ring",
    noteIds: [],
    confidence: 0.9,
  };
}

const many = Array.from({ length: 12 }, (_, i) => comp(i + 1));

const cases: Array<[string, Parameters<typeof PanelDiagram>[0]]> = [
  ["old panel, rows undefined", { components: many }],
  ["rows=2", { components: many, rows: 2, title: "Job" }],
  ["rows=0", { components: many, rows: 0 }],
  ["rows=NaN", { components: many, rows: NaN }],
  ["rows > components", { components: many.slice(0, 2), rows: 5 }],
  ["empty components", { components: [], rows: 2 }],
  [
    "with reorder + highlight",
    {
      components: many,
      rows: 2,
      onReorder: () => {},
      onSelectTile: () => {},
      highlightIds: new Set(["c2"]),
      selectedId: "c1",
    },
  ],
];

let failed = false;
for (const [name, props] of cases) {
  try {
    const html = renderToString(<PanelDiagram {...props} />);
    const ok = html.includes("<svg") && !html.includes("NaN");
    console.log(`${ok ? "PASS" : "FAIL"} ${name} (len=${html.length}${ok ? "" : ", NaN or no svg"})`);
    if (!ok) failed = true;
  } catch (err) {
    failed = true;
    console.log(`THROW ${name}: ${err instanceof Error ? err.message : String(err)}`);
  }
}
process.exit(failed ? 1 : 0);
