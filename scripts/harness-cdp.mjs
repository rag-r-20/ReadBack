// TEMPORARY: drive headless Chrome via CDP to load the board harness page and
// report console errors + whether the SVG board rendered. No dependencies.
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9223;
const url = process.argv[2] ?? "http://localhost:5198/test-board.html";

const profile = mkdtempSync(join(tmpdir(), "chrome-cdp-"));
const chrome = spawn(CHROME, [
  "--headless=new",
  "--disable-gpu",
  "--no-sandbox",
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  "about:blank",
]);
chrome.stderr.on("data", () => {});

async function waitForTarget() {
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json`);
      const targets = await res.json();
      const page = targets.find((t) => t.type === "page");
      if (page) return page.webSocketDebuggerUrl;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("Chrome CDP endpoint never came up");
}

const wsUrl = await waitForTarget();
const ws = new WebSocket(wsUrl);
let nextId = 1;
const pending = new Map();

function send(method, params = {}) {
  const id = nextId++;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve) => pending.set(id, resolve));
}

const logs = [];
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg.result ?? msg.error);
    pending.delete(msg.id);
  } else if (msg.method === "Runtime.consoleAPICalled") {
    const text = msg.params.args.map((a) => a.value ?? a.description ?? "").join(" ");
    logs.push(`[console.${msg.params.type}] ${text}`);
  } else if (msg.method === "Runtime.exceptionThrown") {
    const d = msg.params.exceptionDetails;
    logs.push(`[exception] ${d.text} ${d.exception?.description ?? ""}`);
  }
};

await new Promise((resolve) => (ws.onopen = resolve));
await send("Runtime.enable");
await send("Page.enable");
await send("Page.navigate", { url });
// Let the app seed IndexedDB, render, and run the 1.5s result probe.
await new Promise((r) => setTimeout(r, 5000));
const result = await send("Runtime.evaluate", {
  expression: `JSON.stringify({
    title: document.title,
    errors: document.getElementById('errors')?.textContent ?? null,
    rootHtmlLength: document.getElementById('root')?.innerHTML.length ?? 0,
    hasSvg: Boolean(document.querySelector('#root svg')),
    tileCount: document.querySelectorAll('#root svg g').length,
  })`,
});
console.log("PAGE STATE:", result.result?.value ?? JSON.stringify(result));
console.log("CONSOLE/EXCEPTIONS:");
for (const l of logs) console.log(" ", l);
ws.close();
chrome.kill();
process.exit(0);
