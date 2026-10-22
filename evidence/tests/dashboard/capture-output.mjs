// Captures a real Chromium rendering of the verbatim saved Vitest output.
// Run from the repository root: node evidence/tests/dashboard/capture-output.mjs
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
const temp = mkdtempSync(join(tmpdir(), "dashboard-output-"));
try {
  for (const name of ["test-b-red", "test-b-green"]) {
    const output = readFileSync(`evidence/tests/dashboard/${name}.log`, "utf8");
    const escaped = output.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
    const html = join(temp, `${name}.html`);
    writeFileSync(html, `<!doctype html><meta charset="utf-8"><title>Captured Vitest output — ${name}</title>
      <style>body{background:#172523;color:#f0f2eb;padding:24px;font:14px/1.45 monospace}h1{font:20px sans-serif}pre{white-space:pre-wrap;overflow-wrap:anywhere}</style>
      <h1>Captured Vitest output — ${name}</h1><p>Verbatim saved output. Screenshot taken by Chromium; full raw log accompanies this image.</p><pre>${escaped}</pre>`);
    execFileSync("chromium", [
      "--headless", "--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu",
      "--window-size=1500,1700", `--screenshot=${resolve(`evidence/tests/dashboard/${name}.png`)}`,
      `file://${html}`,
    ], { stdio: "pipe", timeout: 30000 });
  }
} finally { rmSync(temp, { recursive: true, force: true }); }
