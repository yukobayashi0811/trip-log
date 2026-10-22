import { describe, expect, it, vi } from "vitest";
import { drivingSections, routingRevision, type RoutingStop } from "@workspace/api-zod";
import { createRoadRouter, ORS_ENDPOINT } from "../lib/road-routing";

const secret = "synthetic-test-key-not-a-real-credential";
const stop = (n: number, mode: "Driving" | "Flying" | "Other" | null = "Driving"): RoutingStop => ({
  id: `00000000-0000-4000-8000-${String(n + 1).padStart(12, "0")}`,
  latitude: 49.4 + n * 0.001, longitude: 8.6 + n * 0.001, sortOrder: n, transportFromPrevious: mode,
});
const rows = [stop(0), stop(1), stop(2)];
function geo(coordinates: number[][] = [[8.6, 49.4], [8.601, 49.401]]) {
  return { type: "FeatureCollection", metadata: { query: { api_key: secret } }, features: [{
    type: "Feature", geometry: { type: "LineString", coordinates },
    properties: { summary: { distance: 1500, duration: 200 }, private: secret },
  }] };
}
const response = (data: unknown = geo(), status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers });
const create = (send = vi.fn(async () => response()), extra = {}) => ({
  send, route: createRoadRouter({ fetch: send as typeof fetch, key: () => secret, ...extra }),
});

describe("road itinerary planning and server-only provider adapter (controlled mocks)", () => {
  it("sorts saved stops, sends intermediate and recorded return coordinates in longitude-latitude order", async () => {
    const back = { ...stop(3), latitude: rows[0].latitude, longitude: rows[0].longitude };
    const { send, route } = create();
    const result = await route("owner/trip", "trip", [back, rows[2], rows[0], rows[1]]);
    const [url, init] = send.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(ORS_ENDPOINT);
    expect(init).toMatchObject({ method: "POST", redirect: "error", headers: { Authorization: secret } });
    expect(JSON.parse(init.body as string)).toEqual({
      coordinates: [[8.6, 49.4], [8.600999999999999, 49.400999999999996], [8.602, 49.402], [8.6, 49.4]],
      instructions: false, elevation: false,
    });
    expect(result.segments[0].stopIds).toEqual([...rows, back].map(s => s.id));
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(result.segments[0]).toMatchObject({ status: "ready", distanceMeters: 1500, durationSeconds: 200 });
  });
  it("only connects consecutive Driving arrivals, never bridges Flying/Other/null gaps", () => {
    const mixed = [stop(0), stop(1), stop(2, "Flying"), stop(3), stop(4, "Other"), stop(5), stop(6, null)];
    expect(drivingSections(mixed).map(s => s.map(p => p.sortOrder))).toEqual([[0, 1], [2, 3], [4, 5]]);
  });
  it("splits over 50 waypoints with an overlapping boundary and no saved-stop cap", async () => {
    const items = Array.from({ length: 103 }, (_, n) => stop(n));
    expect(drivingSections(items).map(s => s.length)).toEqual([50, 50, 5]);
    expect(drivingSections(items)[1][0].id).toBe(items[49].id);
    const { route, send } = create();
    expect((await route("a", "trip", items)).segments).toHaveLength(3);
    expect(send).toHaveBeenCalledTimes(3);
  });
  it("empty/no-driving itineraries never require a key or call ORS", async () => {
    const { route, send } = create(undefined, { key: () => undefined });
    for (const items of [[], [stop(0)], [stop(0), stop(1, "Flying")], [stop(0), stop(1, "Other")]]) {
      expect((await route("a", "trip", items)).segments).toEqual([]);
    }
    expect(send).not.toHaveBeenCalled();
  });
  it("missing key is actionable, makes no external call, and preserves the input", async () => {
    const before = structuredClone(rows);
    const { route, send } = create(undefined, { key: () => undefined });
    expect((await route("a", "trip", rows)).segments[0]).toMatchObject({ status: "missing_key", coordinates: [] });
    expect(send).not.toHaveBeenCalled(); expect(rows).toEqual(before);
  });
  it("coincident consecutive coordinates need no road line, but a return through another stop is not collapsed", async () => {
    const { route, send } = create();
    expect((await route("a", "trip", [stop(0), { ...stop(1), latitude: 49.4, longitude: 8.6 }])).segments[0])
      .toMatchObject({ status: "ready", coordinates: [], distanceMeters: 0 });
    expect(send).not.toHaveBeenCalled();
  });
  it("deduplicates concurrent identical requests, including an unchanged renamed itinerary", async () => {
    const { route, send } = create();
    const results = await Promise.all([route("a", "trip", rows), route("a", "trip", rows)]);
    expect(results[0]).toEqual(results[1]); expect(send).toHaveBeenCalledTimes(1);
    await route("a", "trip", rows.map(s => ({ ...s, name: "Changed name" })));
    expect(send).toHaveBeenCalledTimes(1);
  });
  it("changed coordinates/order/modes/removal recalculate; ownership scopes do not share cache entries", async () => {
    const { route, send } = create();
    await route("a", "trip", rows);
    await route("b", "trip", rows);
    await route("a", "trip", rows.map((s, i) => i === 1 ? { ...s, latitude: 40 } : s));
    await route("a", "trip", [rows[0], { ...rows[2], sortOrder: 1 }, { ...rows[1], sortOrder: 2 }]);
    await route("a", "trip", [rows[0], { ...rows[1], transportFromPrevious: "Other" }, rows[2]]);
    await route("a", "trip", [rows[0], rows[2]]);
    expect(send).toHaveBeenCalledTimes(6);
    expect(routingRevision(rows)).not.toEqual(routingRevision([rows[0], rows[2]]));
  });
  it("positive cache expires in five minutes; rotating a key bypasses the old entry", async () => {
    let clock = 0; let key = secret;
    const { route, send } = create(undefined, { now: () => clock, key: () => key });
    await route("a", "trip", rows); clock = 299_999; await route("a", "trip", rows);
    expect(send).toHaveBeenCalledTimes(1);
    clock = 300_001; await route("a", "trip", rows);
    key = "another-synthetic-test-key"; await route("a", "trip", rows);
    expect(send).toHaveBeenCalledTimes(3);
  });
  it.each([
    [401, {}, "provider_error"], [403, {}, "provider_error"], [500, {}, "provider_error"],
    [503, {}, "provider_error"], [400, { error: { code: 2004, message: secret } }, "provider_limit"],
    [413, {}, "provider_limit"], [404, { error: { code: 2009 } }, "unreachable"],
    [400, { error: { code: 2010 } }, "unreachable"], [400, { error: { message: secret } }, "provider_error"],
  ])("handles HTTP %i safely, never leaks raw errors or draws fallback geometry", async (status, body, expected) => {
    const { route, send } = create(vi.fn(async () => response(body, status)));
    const result = await route("a", "trip", rows);
    expect(result.segments[0]).toMatchObject({ status: expected, coordinates: [] });
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(send).toHaveBeenCalledTimes(1);
  });
  it("429 respects Retry-After across sections/scopes and decreases cached cooldowns without auto-retrying", async () => {
    let clock = 0;
    const { route, send } = create(vi.fn(async () => response({ error: secret }, 429, { "Retry-After": "120" })), { now: () => clock });
    expect((await route("a", "trip", rows)).segments[0].retryAfterSeconds).toBe(120);
    clock = 30_000;
    expect((await route("a", "trip", rows)).segments[0].retryAfterSeconds).toBe(90);
    expect((await route("b", "trip", rows)).segments[0].status).toBe("rate_limited");
    expect(send).toHaveBeenCalledTimes(1);
  });
  it("limits warm-instance requests below Standard Free's minute budget", async () => {
    const { route, send } = create();
    for (let i = 0; i < 35; i++) await route(`scope${i}`, "trip", rows);
    expect((await route("scope36", "trip", rows)).segments[0].status).toBe("rate_limited");
    expect(send).toHaveBeenCalledTimes(35);
  });
  it("negative caching prevents retry floods", async () => {
    const { route, send } = create(vi.fn(async () => response({}, 503)));
    await route("a", "trip", rows); await route("a", "trip", rows);
    expect(send).toHaveBeenCalledTimes(1);
  });
  it("timeouts abort and return without waiting forever even for a non-cooperative fetch mock", async () => {
    const send = vi.fn(() => new Promise<Response>(() => {}));
    const route = createRoadRouter({ fetch: send as typeof fetch, key: () => secret, timeoutMs: 5 });
    expect((await route("a", "trip", rows)).segments[0].status).toBe("timeout");
    expect((send.mock.calls[0] as unknown as [string, RequestInit])[1].signal?.aborted).toBe(true);
  });
  it("does not expose thrown network/header/key details", async () => {
    const { route } = create(vi.fn(async () => { throw new Error(secret); }));
    expect(JSON.stringify(await route("a", "trip", rows))).not.toContain(secret);
  });
  it.each([
    {}, { type: "FeatureCollection", features: [] }, geo([[181, 40], [8, 40]]),
    geo([[8, 91], [8, 40]]), geo([[8, 40, 2], [8, 40, 3]]), geo([[8, 40]]),
    geo([[Number.NaN, 40], [8, 40]]),
    { ...geo(), features: [...geo().features, ...geo().features] },
    { type: "FeatureCollection", features: [{ ...geo().features[0], properties: {} }] },
  ])("rejects invalid provider geometry/summary rather than fabricating a road", async body => {
    const { route } = create(vi.fn(async () => response(body)));
    expect((await route("a", "trip", rows)).segments[0]).toMatchObject({ status: "invalid_response", coordinates: [] });
  });
  it("malformed JSON is a safe invalid response", async () => {
    const { route } = create(vi.fn(async () => new Response("<html>bad gateway</html>")));
    expect((await route("a", "trip", rows)).segments[0].status).toBe("invalid_response");
  });
  it("allows a partial journey without drawing a line across the failed section", async () => {
    const send = vi.fn().mockResolvedValueOnce(response()).mockResolvedValueOnce(response({ error: { code: 2010 } }, 404));
    const route = createRoadRouter({ fetch: send, key: () => secret });
    const result = await route("a", "trip", [stop(0), stop(1), stop(2, "Flying"), stop(3)]);
    expect(result.segments.map(s => s.status)).toEqual(["ready", "unreachable"]);
    expect(result.segments[1].coordinates).toEqual([]);
  });
  it("honors a dated Retry-After and does not shorten a valid cooldown beyond a day", async () => {
    const now = Date.parse("2026-10-22T00:00:00Z");
    const { route } = create(vi.fn(async () => response({}, 429, { "Retry-After": new Date(now + 90_000).toUTCString() })), { now: () => now });
    expect((await route("a", "trip", rows)).segments[0].retryAfterSeconds).toBe(90);
    const long = create(vi.fn(async () => response({}, 429, { "Retry-After": "90000" })));
    expect((await long.route("b", "trip", rows)).segments[0].retryAfterSeconds).toBe(90000);
  });
  it("caps simultaneous external calls and releases them cleanly", async () => {
    const finish: ((response: Response) => void)[] = [];
    const send = vi.fn(() => new Promise<Response>(resolve => finish.push(resolve)));
    const route = createRoadRouter({ fetch: send as typeof fetch, key: () => secret });
    const first = route("first", "trip", rows); const second = route("second", "trip", rows);
    expect((await route("third", "trip", rows)).segments[0].status).toBe("busy");
    finish.forEach(resolve => resolve(response()));
    expect((await first).segments[0].status).toBe("ready");
    await second; expect(send).toHaveBeenCalledTimes(2);
  });
  it("bounds provider response bytes before parsing", async () => {
    const { route } = create(vi.fn(async () => new Response("x".repeat(4 * 1024 * 1024 + 1))));
    expect((await route("a", "trip", rows)).segments[0].status).toBe("invalid_response");
  });
  it("bounds transient cache entries without storing permanent route data", async () => {
    const { route, send } = create(undefined, { now: () => 0 });
    // Different scopes exhaust the conservative minute limit before the cache.
    // Advance time to exercise eviction rather than provider throttling.
    let clock = 0;
    const estimate = createRoadRouter({ fetch: send as typeof fetch, key: () => secret, now: () => clock });
    for (let i = 0; i < 65; i++) { clock = i * 2000; await estimate(`scope${i}`, "trip", rows); }
    await estimate("scope0", "trip", rows);
    expect(send).toHaveBeenCalledTimes(66);
    void route;
  });
  it("stops at the conservative warm-instance daily budget without a paid fallback", async () => {
    let clock = 0;
    const { route, send } = create(undefined, { now: () => clock });
    for (let i = 0; i < 1900; i++) { clock = i * 2000; await route(`scope${i}`, "trip", rows); }
    clock += 2000;
    expect((await route("over-budget", "trip", rows)).segments[0].status).toBe("rate_limited");
    expect(send).toHaveBeenCalledTimes(1900);
  });
});
