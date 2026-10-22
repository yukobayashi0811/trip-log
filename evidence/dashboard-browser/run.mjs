// Run from this feature checkout with inherited Clerk DEVELOPMENT secrets only.
// Uses real Clerk ticket sessions and real app APIs; no auth or data mocking.
import { spawn, execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { resolve, dirname, join } from "node:path";
import { tmpdir } from "node:os";

const out = dirname(new URL(import.meta.url).pathname);
const repo = resolve(out, "../..");
const origin = "http://127.0.0.1:23451";
const testedCommit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo, encoding: "utf8" }).trim();
const appDiff = execFileSync("git", ["diff", "--name-only", "HEAD", "--", "artifacts", "lib"], { cwd: repo, encoding: "utf8" }).trim();
const results = [], requests = [], identities = [], contexts = [], browserErrors = [];
const pending = new Map();
const pause = ms => new Promise(r => setTimeout(r, ms));
let browser, socket, clerk, profile, sequence = 0, mode = "pass", held;
function command(method, params = {}, sessionId) {
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 30000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
}
async function evaluate(s, expression) {
  const r = await command("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }, s);
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
  return r.result?.value;
}
async function wait(s, expression, label) {
  for (let i = 0; i < 200; i++) {
    if (await evaluate(s, expression).catch(() => false)) return;
    await pause(100);
  }
  throw new Error(`Timed out: ${label}`);
}
async function record(name, passed) {
  results.push({ name, passed: Boolean(passed) });
  console.log(`${passed ? "PASS" : "FAIL"} ${name}`);
  if (!passed) throw new Error(name);
}
async function navigate(s, path) {
  const mark = randomUUID();
  await evaluate(s, `window.__dashboardRun=${JSON.stringify(mark)}`);
  await command("Page.navigate", { url: origin + path }, s);
  await wait(s, `window.__dashboardRun!==${JSON.stringify(mark)}&&document.readyState==="complete"&&window.Clerk?.loaded`, "page and Clerk");
}
async function api(s, path, method = "GET", body) {
  return evaluate(s, `(async()=>{const r=await fetch(${JSON.stringify(path)},{method:${JSON.stringify(method)},headers:{"Content-Type":"application/json"},${body ? `body:JSON.stringify(${JSON.stringify(body)}),` : ""}});return{status:r.status,body:r.status===204?null:await r.json()}})()`);
}
async function create(s, path, body) {
  const r = await api(s, path, "POST", body);
  if (r.status !== 201) throw new Error(`Fixture creation ${path}: HTTP ${r.status}`);
  return r.body;
}
async function totals(s, expected) {
  const literal = JSON.stringify(expected);
  await wait(s, `(()=>{const ids=["text-total-trips","text-total-stops","text-total-nights"];return ids.every((id,i)=>document.querySelector('[data-testid="'+id+'"]')?.textContent===String(${literal}[i]))})()`, `UI totals ${expected}`);
}
async function shot(s, name, full = false) {
  await pause(350);
  const params = { format: "png", captureBeyondViewport: full };
  if (full) {
    const { cssContentSize: size } = await command("Page.getLayoutMetrics", {}, s);
    params.clip = { x: 0, y: 0, width: size.width, height: size.height, scale: 1 };
  }
  const image = await command("Page.captureScreenshot", params, s);
  await writeFile(join(out, `${name}.png`), Buffer.from(image.data, "base64"));
}
async function newContext() {
  const { browserContextId } = await command("Target.createBrowserContext");
  const { targetId } = await command("Target.createTarget", { url: "about:blank", browserContextId });
  const { sessionId: s } = await command("Target.attachToTarget", { targetId, flatten: true });
  const c = { s, tripIds: [], userId: undefined };
  contexts.push(c);
  await command("Page.enable", {}, s);
  await command("Runtime.enable", {}, s);
  await command("Network.enable", {}, s);
  await command("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false }, s);
  await navigate(s, "/");
  return c;
}
async function signIn(c, label) {
  const user = await clerk.users.createUser({
    emailAddress: [`dash-${randomUUID()}+clerk_test@example.com`],
    skipPasswordRequirement: true,
  });
  identities.push(user.id); c.userId = user.id;
  const ticket = await clerk.signInTokens.createSignInToken({ userId: user.id, expiresInSeconds: 120 });
  const ok = await evaluate(c.s, `(async()=>{const r=await window.Clerk.client.signIn.create({strategy:"ticket",ticket:${JSON.stringify(ticket.token)}});if(r.status!=="complete")return false;await window.Clerk.setActive({session:r.createdSessionId});return true})()`);
  await record(`${label}: real Clerk Development session authenticated`, ok);
}
async function seedTrip(c, title, startDate, endDate, nights) {
  const trip = await create(c.s, "/api/trips", { title, startDate, endDate });
  c.tripIds.push(trip.id);
  for (let i = 0; i < nights.length; i++) {
    const stop = await create(c.s, `/api/trips/${trip.id}/stops`, { name: `Synthetic stop ${i + 1}`, latitude: 35 + i / 10, longitude: -120 });
    if (nights[i]) await create(c.s, `/api/trips/${trip.id}/stops/${stop.id}/stay`, { accommodationType: "Hotel", checkIn: nights[i][0], checkOut: nights[i][1] });
  }
  if ((await api(c.s, `/api/trips/${trip.id}/star`, "PUT")).status !== 200) throw new Error("Fixture star failed");
}

try {
  await mkdir(out, { recursive: true });
  if (appDiff) throw new Error(`Uncommitted application source: ${appDiff}`);
  if (!process.env.CLERK_SECRET_KEY?.startsWith("sk_test_")) throw new Error("Development-only authorization unavailable");
  const require = createRequire(`${repo}/artifacts/api-server/package.json`);
  ({ clerkClient: clerk } = await import(pathToFileURL(require.resolve("@clerk/express")).href));
  profile = await mkdtemp(join(tmpdir(), "dashboard-browser-"));
  browser = spawn("/repl/tools/bin/chromium", [
    "--headless", "--no-sandbox", "--disable-dev-shm-usage",
    "--remote-debugging-port=0", "--remote-debugging-address=127.0.0.1",
    `--user-data-dir=${profile}`, "--no-first-run", "about:blank",
  ], { stdio: "ignore" });
  let port;
  for (let i = 0; i < 100; i++) {
    try { port = Number((await readFile(join(profile, "DevToolsActivePort"), "utf8")).split("\n")[0]); break; } catch {}
    await pause(100);
  }
  if (!port) throw new Error("Chromium failed to start");
  const version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
  socket = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((r, j) => { socket.addEventListener("open", r, { once: true }); socket.addEventListener("error", j, { once: true }); });
  socket.addEventListener("message", async event => {
    const m = JSON.parse(event.data);
    if (m.id) {
      const p = pending.get(m.id); if (!p) return;
      pending.delete(m.id); clearTimeout(p.timer);
      m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result);
    } else if (m.method === "Network.responseReceived" && m.params.response.url.startsWith(origin + "/api/dashboard")) {
      requests.push({ endpoint: "/api/dashboard", status: m.params.response.status });
    } else if (m.method === "Runtime.exceptionThrown") {
      browserErrors.push(m.params.exceptionDetails.text);
    } else if (m.method === "Fetch.requestPaused") {
      const item = { requestId: m.params.requestId, session: m.sessionId };
      if (mode === "hold") held = item;
      else if (mode === "fail") await command("Fetch.fulfillRequest", { requestId: item.requestId, responseCode: 500, responseHeaders: [{ name: "Content-Type", value: "application/json" }], body: Buffer.from('{"error":"Controlled dashboard outage"}').toString("base64") }, item.session);
      else await command("Fetch.continueRequest", { requestId: item.requestId }, item.session);
    }
  });
  const a = await newContext();
  await record("Unauthenticated dashboard is denied", (await api(a.s, "/api/dashboard")).status === 401);
  await signIn(a, "User A");
  await navigate(a.s, "/trips");
  await wait(a.s, '!!document.querySelector(\'[data-testid="link-nav-dashboard"]\')', "dashboard navigation");
  await evaluate(a.s, 'document.querySelector(\'[data-testid="link-nav-dashboard"]\').click()');
  await totals(a.s, [0, 0, 0]);
  await record("Empty authenticated dashboard has honest zeros and empty state", await evaluate(a.s, '!!document.querySelector(\'[data-testid="status-empty"]\')'));
  await shot(a.s, "empty-desktop");
  await seedTrip(a, "Synthetic Dashboard A", "2026-03-07", "2026-11-03", [["2026-03-07", "2026-03-09"], ["2026-11-01", "2026-11-02"], null]);
  await seedTrip(a, "Synthetic Dashboard Jan", "2027-01-01", "2027-01-02", [null]);
  await navigate(a.s, "/dashboard");
  await totals(a.s, [2, 4, 3]);
  await record("Two stays total exactly three nights; extra stops and stars do not multiply metrics", true);
  await record("Monthly table uses trip start month and retains year", await evaluate(a.s, 'document.querySelector(\'[data-testid="row-month-2026-03"]\')?.textContent.includes("March 2026")&&document.querySelector(\'[data-testid="row-month-2027-01"]\')?.textContent.includes("January 2027")&&document.querySelectorAll(\'[data-testid="table-trips-by-month"] tbody tr\').length===2'));
  await shot(a.s, "dashboard-desktop");
  await navigate(a.s, "/dashboard"); await totals(a.s, [2, 4, 3]);
  await record("Reload preserves the saved dashboard metrics", true);
  await command("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true }, a.s);
  await record("390px mobile has no horizontal overflow", await evaluate(a.s, "document.documentElement.scrollWidth<=window.innerWidth"));
  await record("Mobile dashboard nav is labelled, reachable and touch-sized", await evaluate(a.s, '(()=>{const e=document.querySelector(\'[data-testid="link-nav-dashboard"]\');const r=e?.getBoundingClientRect();return e?.getAttribute("aria-label")==="Dashboard"&&r.width>=44&&r.height>=44&&r.right<=innerWidth})()'));
  await record("Mobile monthly table and nights are readable", await evaluate(a.s, '!!document.querySelector(\'[data-testid="table-trips-by-month"]\')&&document.querySelector(\'[data-testid="text-total-nights"]\').textContent==="3"'));
  await shot(a.s, "dashboard-mobile", true);
  await command("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false }, a.s);
  await command("Fetch.enable", { patterns: [{ urlPattern: origin + "/api/dashboard*", requestStage: "Request" }] }, a.s);
  mode = "hold";
  await navigate(a.s, "/dashboard");
  await wait(a.s, '!!document.querySelector(\'[data-testid="status-loading"]\')', "loading skeleton");
  await record("Delayed dashboard response shows loading, not invented zeros", await evaluate(a.s, '!document.querySelector(\'[data-testid="text-total-nights"]\')'));
  await shot(a.s, "loading-desktop");
  mode = "pass";
  if (!held) throw new Error("No delayed dashboard request");
  await command("Fetch.continueRequest", { requestId: held.requestId }, held.session); held = undefined;
  await totals(a.s, [2, 4, 3]);
  // SPA navigation retains the query cache; remount always refetches. This
  // deterministically exercises a failed refresh with previously valid data.
  await evaluate(a.s, 'document.querySelector(\'[data-testid="link-nav-trips"]\').click()');
  await wait(a.s, 'location.pathname==="/trips"', "All Trips navigation");
  mode = "fail";
  await evaluate(a.s, 'document.querySelector(\'[data-testid="link-nav-dashboard"]\').click()');
  await wait(a.s, '!!document.querySelector(\'[data-testid="button-retry"]\')', "actionable error");
  await record("Failed refresh hides stale metrics and exposes Retry", await evaluate(a.s, '!document.querySelector(\'[data-testid="text-total-nights"]\')&&document.body.textContent.includes("dashboard didn")'));
  await shot(a.s, "error-desktop");
  mode = "pass";
  await evaluate(a.s, 'document.querySelector(\'[data-testid="button-retry"]\').click()');
  await totals(a.s, [2, 4, 3]);
  await record("Retry recovers genuine saved totals", true);
  await command("Fetch.disable", {}, a.s);
  const b = await newContext();
  await signIn(b, "User B");
  await navigate(b.s, "/dashboard"); await totals(b.s, [0, 0, 0]);
  await record("Independent User B sees none of User A's data", true);
  await seedTrip(b, "Synthetic Dashboard B", "2026-04-01", "2026-04-12", [["2026-04-01", "2026-04-11"]]);
  await navigate(b.s, "/dashboard"); await totals(b.s, [1, 1, 10]);
  await record("User B gets only their own one trip, one stop and ten nights", true);
  await shot(b.s, "user-b-desktop");
  await navigate(a.s, "/dashboard"); await totals(a.s, [2, 4, 3]);
  await record("User A remains isolated after User B records ten nights", await evaluate(a.s, '!document.querySelector(\'[data-testid="row-month-2026-04"]\')'));
  await record("No unhandled browser exceptions", browserErrors.length === 0);
} catch (error) {
  console.log(`FAIL ${error.message}`); results.push({ name: error.message, passed: false });
  process.exitCode = 1;
} finally {
  mode = "pass";
  if (held) await command("Fetch.continueRequest", { requestId: held.requestId }, held.session).catch(() => {});
  for (const c of contexts) {
    for (const id of c.tripIds) {
      try { const r = await api(c.s, `/api/trips/${id}`, "DELETE"); await record("Synthetic owner trip cleanup returns 204", r.status === 204); } catch (e) { results.push({ name: `Cleanup: ${e.message}`, passed: false }); process.exitCode = 1; }
    }
    if (c.userId) await evaluate(c.s, "window.Clerk.signOut()").catch(() => {});
  }
  for (const id of identities) {
    try { await clerk.users.deleteUser(id); } catch { results.push({ name: "Development identity cleanup failed", passed: false }); process.exitCode = 1; }
  }
  if (socket?.readyState === WebSocket.OPEN) { await command("Browser.close").catch(() => {}); socket.close(); }
  browser?.kill("SIGTERM");
  if (profile) await rm(profile, { recursive: true, force: true });
  await writeFile(join(out, "browser-results.json"), JSON.stringify({
    testedCommit, uncommittedApplicationFiles: appDiff ? appDiff.split("\n") : [],
    testedAt: new Date().toISOString(), origin, database: "isolated local feature10_browser",
    authentication: "real temporary Clerk Development accounts and short-lived tickets; no auth bypass",
    builtInTester: "unavailable: Unknown config kind: testing",
    interception: "Only delay/500 for loading/error/retry; success metrics use actual API/database",
    results, requests, browserErrors,
  }, null, 2));
}
