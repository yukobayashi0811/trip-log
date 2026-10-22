import { createHash } from "node:crypto";
import { drivingSections, routingRevision, type DrivingRoute, type RoutingStop, type TripRouting } from "@workspace/api-zod";

export const ORS_ENDPOINT = "https://api.heigit.org/openrouteservice/v2/directions/driving-car/geojson";
type Estimate = Omit<DrivingRoute, "stopIds">;
type Options = { fetch?: typeof fetch; key?: () => string | undefined; now?: () => number; timeoutMs?: number };
const MAX_BODY = 4 * 1024 * 1024;
const readyTtl = 5 * 60_000;
const failureTtl = 30_000;
const fail = (status: DrivingRoute["status"], message: string, retryAfterSeconds?: number): Estimate =>
  ({ status, message, coordinates: [], ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}) });
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

// Only allowlisted numeric geometry/summary ever leaves this adapter. In
// particular ORS metadata.query, response headers, bodies and error text can
// contain credentials/personal data and must never be returned or logged.
function geometry(value: unknown): Estimate | null {
  if (!record(value) || value.type !== "FeatureCollection" || !Array.isArray(value.features) || value.features.length !== 1) return null;
  const feature = value.features[0];
  if (!record(feature) || feature.type !== "Feature" || !record(feature.geometry) ||
    feature.geometry.type !== "LineString" || !Array.isArray(feature.geometry.coordinates)) return null;
  const coords = feature.geometry.coordinates;
  if (coords.length < 2 || coords.length > 100_000 || coords.some(p => !Array.isArray(p) || p.length !== 2 ||
    typeof p[0] !== "number" || !Number.isFinite(p[0]) || Math.abs(p[0]) > 180 ||
    typeof p[1] !== "number" || !Number.isFinite(p[1]) || Math.abs(p[1]) > 90)) return null;
  const summary = record(feature.properties) && record(feature.properties.summary) ? feature.properties.summary : null;
  if (!summary || typeof summary.distance !== "number" || !Number.isFinite(summary.distance) || summary.distance < 0 ||
    typeof summary.duration !== "number" || !Number.isFinite(summary.duration) || summary.duration < 0) return null;
  return { status: "ready", message: "Estimated Driving Route", coordinates: coords as number[][],
    distanceMeters: summary.distance, durationSeconds: summary.duration };
}

async function boundedJson(response: Response): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");
  const pieces: Uint8Array[] = []; let size = 0;
  try {
    for (;;) {
      const item = await reader.read(); if (item.done) break;
      size += item.value.byteLength;
      if (size > MAX_BODY) { await reader.cancel(); throw new Error("Response too large"); }
      pieces.push(item.value);
    }
  } finally { reader.releaseLock(); }
  return JSON.parse(Buffer.concat(pieces).toString("utf8"));
}

// Per-process, bounded, transient only. Caller MUST establish ownership before
// invoking, including cache hits. No DB writes, persistent geometry or paid fallback.
export function createRoadRouter(options: Options = {}) {
  const send = options.fetch ?? fetch;
  const key = options.key ?? (() => process.env.ORS_API_KEY);
  const now = options.now ?? Date.now;
  const cache = new Map<string, { expires: number; created: number; result: Estimate }>();
  const pending = new Map<string, Promise<Estimate>>();
  let minute: number[] = []; let daily: number[] = []; let pauseUntil = 0; let active = 0;
  function secondsUntil(time: number) { return Math.max(1, Math.ceil((time - now()) / 1000)); }
  async function call(coordinates: number[][], secret: string): Promise<Estimate> {
    if (now() < pauseUntil) return fail("rate_limited", "Routing quota or rate limit reached. Try again after the cooldown.", secondsUntil(pauseUntil));
    minute = minute.filter(t => now() - t < 60_000);
    daily = daily.filter(t => now() - t < 86_400_000);
    // Below Standard Free's 40/min and 2,000/day; provider remains authoritative
    // across cold starts, other consumers of the same key and other instances.
    if (minute.length >= 35 || daily.length >= 1900) {
      const next = minute.length >= 35 ? minute[0] + 60_000 : daily[0] + 86_400_000;
      return fail("rate_limited", "The free routing request budget is paused. Saved stops are unchanged.", secondsUntil(next));
    }
    if (active >= 2) return fail("busy", "Routing is busy. Please try again shortly.", 5);
    active++; minute.push(now()); daily.push(now());
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<Estimate>(resolve => {
      timer = setTimeout(() => { controller.abort(); resolve(fail("timeout", "Routing timed out. Your stops are safe; try again later.", 30)); }, options.timeoutMs ?? 10_000);
    });
    const task = (async (): Promise<Estimate> => {
      try {
        const response = await send(ORS_ENDPOINT, {
          method: "POST", redirect: "error", signal: controller.signal,
          headers: { Authorization: secret, "Content-Type": "application/json", Accept: "application/geo+json, application/json" },
          body: JSON.stringify({ coordinates, instructions: false, elevation: false }),
        });
        if (response.status === 429) {
          const raw = response.headers.get("retry-after");
          const seconds = raw && /^\d+$/.test(raw) ? Number(raw) : raw ? Math.ceil((Date.parse(raw) - now()) / 1000) : 60;
          pauseUntil = Math.max(pauseUntil, Math.min(Number.MAX_SAFE_INTEGER,
            now() + Math.max(60, Number.isFinite(seconds) ? seconds : 60) * 1000));
          await response.body?.cancel();
          return fail("rate_limited", "openrouteservice free quota or rate limit reached. No paid fallback is used.", secondsUntil(pauseUntil));
        }
        if (response.status === 401 || response.status === 403) {
          await response.body?.cancel();
          pauseUntil = Math.max(pauseUntil, now() + 60_000);
          return fail("provider_error", "Routing credentials were rejected. The app owner should check ORS_API_KEY and its free-plan quota.", 60);
        }
        if (response.status >= 500) { await response.body?.cancel(); return fail("provider_error", "The routing provider is unavailable. Try again later.", 30); }
        if (!response.ok) {
          const body = await boundedJson(response).catch(() => null);
          const code = record(body) && record(body.error) ? body.error.code : undefined;
          return code === 2004 || response.status === 413
            ? fail("provider_limit", "This driving section exceeds an ORS distance or waypoint restriction. Stops remain saved.")
            : code === 2009 || code === 2010
              ? fail("unreachable", "No driving route was found for this section. Check locations near roads or split the journey.")
              : fail("provider_error", "The routing provider rejected this request. Your stops are unchanged.", 30);
        }
        let body: unknown;
        try { body = await boundedJson(response); }
        catch {
          if (controller.signal.aborted) throw new Error("Aborted");
          return fail("invalid_response", "The provider returned unreadable road geometry. No replacement line was drawn.", 30);
        }
        return geometry(body) ?? fail("invalid_response", "The provider returned invalid road geometry. No replacement line was drawn.", 30);
      } catch {
        // Never log or rethrow fetch errors (they can include header/key data).
        return controller.signal.aborted
          ? fail("timeout", "Routing timed out. Your stops are safe; try again later.", 30)
          : fail("provider_error", "The routing response could not be read. Try again later.", 30);
      }
    })();
    try { return await Promise.race([task, timeout]); }
    finally { clearTimeout(timer); active--; }
  }
  async function estimate(scope: string, coordinates: number[][]): Promise<Estimate> {
    const secret = key()?.trim();
    if (!secret) return fail("missing_key", "Routing is not configured. The app owner must add the server-only ORS_API_KEY in Replit Secrets.");
    // Include a non-reversible fingerprint so rotating a key bypasses failures.
    const id = createHash("sha256").update(JSON.stringify([scope, secret, coordinates])).digest("hex");
    const hit = cache.get(id);
    if (hit && hit.expires > now()) return hit.result.retryAfterSeconds === undefined ? hit.result : {
      ...hit.result, retryAfterSeconds: Math.max(0, Math.ceil(hit.result.retryAfterSeconds - (now() - hit.created) / 1000)),
    };
    const existing = pending.get(id); if (existing) return existing;
    if (pending.size >= 128) return fail("busy", "Routing is busy. Try again shortly.", 5);
    const task = call(coordinates, secret).then(result => {
      const ttl = result.status === "ready" ? readyTtl : result.retryAfterSeconds === undefined ? failureTtl : Math.max(1000, result.retryAfterSeconds * 1000);
      cache.delete(id); cache.set(id, { expires: now() + ttl, created: now(), result });
      while (cache.size > 64 || [...cache.values()].reduce((sum, item) => sum + item.result.coordinates.length, 0) > 200_000) {
        cache.delete(cache.keys().next().value!);
      }
      return result;
    }).finally(() => pending.delete(id));
    pending.set(id, task);
    return task;
  }
  return async (scope: string, tripId: string, stops: RoutingStop[]): Promise<TripRouting> => {
    const segments: DrivingRoute[] = [];
    const deadline = now() + 20_000;
    for (const section of drivingSections(stops)) {
      const coordinates = section.map(s => [s.longitude, s.latitude])
        .filter((p, i, rows) => i === 0 || p[0] !== rows[i - 1][0] || p[1] !== rows[i - 1][1]);
      const result: Estimate = coordinates.length < 2
        ? { status: "ready", message: "These consecutive stops share a location; no road line is needed.", coordinates: [], distanceMeters: 0, durationSeconds: 0 }
        : now() >= deadline
          ? fail("busy", "More driving sections are waiting. Try again shortly; completed sections are cached.", 5)
          : await estimate(scope, coordinates);
      segments.push({ ...result, stopIds: section.map(s => s.id) });
    }
    return { tripId, stopRevision: routingRevision(stops), segments };
  };
}
export const estimateOwnedRoads = createRoadRouter();
