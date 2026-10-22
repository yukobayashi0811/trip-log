import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db, pool, stops, users } from "@workspace/db";

const clerk = vi.hoisted(() => ({ userId: null as string | null, getUser: vi.fn() }));
const provider = vi.hoisted(() => ({ key: "synthetic-key-not-a-real-secret" as string | undefined, fetch: vi.fn() }));
vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  getAuth: () => ({ userId: clerk.userId }), clerkClient: { users: { getUser: clerk.getUser } },
}));
vi.mock("../lib/road-routing", async importOriginal => {
  const actual = await importOriginal<typeof import("../lib/road-routing")>();
  return { ...actual, estimateOwnedRoads: actual.createRoadRouter({
    key: () => provider.key, fetch: (...args) => provider.fetch(...args),
  }) };
});
import app from "../app";
const identities: string[] = [];
let tripId: string;
const path = () => `/api/trips/${tripId}/routes`;
async function signIn() {
  const id = `test_auth_routing_${randomUUID()}`; identities.push(id); clerk.userId = id;
  clerk.getUser.mockResolvedValue({ id, primaryEmailAddressId: "p",
    emailAddresses: [{ id: "p", emailAddress: "routing@example.invalid", verification: { status: "verified" } }] });
  expect((await request(app).get("/api/auth/me")).status).toBe(200);
}
async function add(name: string, latitude: number, mode: string | null = "Driving") {
  const response = await request(app).post(`/api/trips/${tripId}/stops`).send({
    name, latitude, longitude: 8.6, transportFromPrevious: mode,
  });
  expect(response.status).toBe(201); return response.body;
}
beforeEach(async () => {
  provider.key = "synthetic-key-not-a-real-secret";
  provider.fetch.mockReset().mockImplementation(async (_url: string, init: RequestInit) =>
    new Response(JSON.stringify({ type: "FeatureCollection", metadata: { query: { api_key: provider.key } }, features: [{
      type: "Feature", geometry: { type: "LineString", coordinates: JSON.parse(init.body as string).coordinates },
      properties: { summary: { distance: 1200, duration: 200 } },
    }] })));
  await signIn();
  const created = await request(app).post("/api/trips").send({
    title: "Synthetic routing fixture", startDate: "2026-05-01", endDate: "2026-05-04",
  });
  expect(created.status).toBe(201); tripId = created.body.id;
});
afterAll(async () => {
  if (identities.length) await db.delete(users).where(inArray(users.clerkUserId, identities));
  await pool.end();
});
describe("owned saved-itinerary routing HTTP/PostgreSQL integration", () => {
  it("routes ordered saved stops with intermediate and return points; GET never changes saved rows", async () => {
    const a = await add("A", 49.4); const b = await add("B", 49.41); const c = await add("Return A", 49.4);
    const before = await db.select().from(stops).where(eq(stops.tripId, tripId));
    const result = await request(app).get(path());
    expect(result.status).toBe(200); expect(result.headers["cache-control"]).toBe("no-store");
    expect(result.body.segments[0]).toMatchObject({ status: "ready", stopIds: [a.id, b.id, c.id],
      coordinates: [[8.6, 49.4], [8.6, 49.41], [8.6, 49.4]] });
    expect(JSON.stringify(result.body)).not.toContain(provider.key);
    expect(await db.select().from(stops).where(eq(stops.tripId, tripId))).toEqual(before);
    await request(app).get(path()); expect(provider.fetch).toHaveBeenCalledTimes(1);
  });
  it("User B cannot obtain User A routes even with a warmed cache and known trip UUID", async () => {
    await add("Private A", 49.4); await add("Private B", 49.41);
    const before = await db.select().from(stops).where(eq(stops.tripId, tripId));
    expect((await request(app).get(path())).status).toBe(200);
    provider.fetch.mockClear();
    await signIn();
    const denied = await request(app).get(path());
    expect(denied.status).toBe(404);
    expect(JSON.stringify(denied.body)).not.toContain("stopRevision");
    expect(provider.fetch).not.toHaveBeenCalled();
    expect(await db.select().from(stops).where(eq(stops.tripId, tripId))).toEqual(before);
  });
  it("unauthenticated and forged-identity header requests are denied without provider work", async () => {
    clerk.userId = null;
    expect((await request(app).get(path()).set("x-user-id", randomUUID())).status).toBe(401);
    expect(provider.fetch).not.toHaveBeenCalled();
  });
  it("unknown and malformed UUIDs are rejected before provider work", async () => {
    expect((await request(app).get("/api/trips/not-a-uuid/routes")).status).toBe(400);
    expect((await request(app).get(`/api/trips/${randomUUID()}/routes`)).status).toBe(404);
    expect(provider.fetch).not.toHaveBeenCalled();
  });
  it("client query coordinates and transport cannot override the owned saved itinerary", async () => {
    await add("A", 49.4); await add("B", 49.41);
    const result = await request(app).get(`${path()}?coordinates=0,0&userId=forged&transport=Flying`);
    expect(result.status).toBe(200);
    expect(result.body.segments[0].coordinates).toEqual([[8.6, 49.4], [8.6, 49.41]]);
  });
  it("missing credentials leave saved markers/records intact with a clear status", async () => {
    provider.key = undefined;
    await add("A", 49.4); await add("B", 49.41);
    const result = await request(app).get(path());
    expect(result.status).toBe(200); expect(result.body.segments[0].status).toBe("missing_key");
    expect(provider.fetch).not.toHaveBeenCalled();
    expect((await request(app).get(`/api/trips/${tripId}/stops`)).body).toHaveLength(2);
  });
  it("reorder, coordinate update, mode change and deletion invalidate the routing revision", async () => {
    const a = await add("A", 49.4); const b = await add("B", 49.41); const c = await add("C", 49.42);
    const first = (await request(app).get(path())).body;
    await request(app).put(`/api/trips/${tripId}/stops/order`).send({ stopIds: [c.id, b.id, a.id] }).expect(200);
    const reordered = (await request(app).get(path())).body;
    expect(reordered.stopRevision).not.toBe(first.stopRevision);
    expect(reordered.segments[0].stopIds).toEqual([c.id, b.id, a.id]);
    await request(app).put(`/api/trips/${tripId}/stops/${b.id}`).send({
      name: "B moved", latitude: 49.415, longitude: 8.61, transportFromPrevious: "Flying",
    }).expect(200);
    const changed = (await request(app).get(path())).body;
    expect(changed.segments[0].stopIds).toEqual([b.id, a.id]);
    expect(changed.segments[0].coordinates[0]).toEqual([8.61, 49.415]);
    await request(app).delete(`/api/trips/${tripId}/stops/${a.id}`).expect(204);
    expect((await request(app).get(path())).body.segments).toEqual([]);
  });
  it("no-driving itinerary does not call the provider", async () => {
    await add("A", 49.4); await add("B", 49.41, "Other");
    expect((await request(app).get(path())).body.segments).toEqual([]);
    expect(provider.fetch).not.toHaveBeenCalled();
  });
});
