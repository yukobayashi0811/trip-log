import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db, pool, stops, trips, users } from "@workspace/db";

const clerk = vi.hoisted(() => ({ userId: null as string | null, getUser: vi.fn() }));
vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  getAuth: () => ({ userId: clerk.userId }),
  clerkClient: { users: { getUser: clerk.getUser } },
}));
import app from "../app";
const identities: string[] = [];
const input = { name: "Test stop", latitude: 35.12345678, longitude: -82.98765432,
  visitDate: "2024-02-29", stopType: "Park", transportFromPrevious: "Driving", notes: "\n  Keep notes\n" };
let tripId: string;
let userId: string;
const path = () => `/api/trips/${tripId}/stops`;
async function signIn() {
  const id = `test_auth_map_${randomUUID()}`;
  identities.push(id); clerk.userId = id;
  clerk.getUser.mockResolvedValue({
    id, primaryEmailAddressId: "primary",
    emailAddresses: [{ id: "primary", emailAddress: "map-test@example.invalid", verification: { status: "verified" } }],
  });
  const response = await request(app).get("/api/auth/me");
  expect(response.status).toBe(200);
  return response.body.id as string;
}
async function createTrip() {
  const response = await request(app).post("/api/trips").send({
    title: "Synthetic map fixture", startDate: "2024-02-28", endDate: "2024-03-02",
  });
  expect(response.status).toBe(201);
  return response.body.id as string;
}
async function createStop(extra = {}) {
  const response = await request(app).post(path()).send({ ...input, ...extra });
  expect(response.status).toBe(201);
  return response.body as { id: string; sortOrder: number; [key: string]: unknown };
}
const stored = () => db.select().from(stops).where(eq(stops.tripId, tripId))
  .orderBy(asc(stops.sortOrder), asc(stops.id));
beforeEach(async () => { userId = await signIn(); tripId = await createTrip(); });
afterAll(async () => {
  if (identities.length) await db.delete(users).where(inArray(users.clerkUserId, identities));
  await pool.end();
});

describe("owned trip stop CRUD and atomic ordering on real PostgreSQL", () => {
  it("creates, lists, reads, edits, clears optionals, inserts/moves positions and compacts on deletion", async () => {
    const parentBefore = await db.select().from(trips).where(eq(trips.id, tripId));
    const first = await createStop({ name: "  First  " });
    expect(first).toMatchObject({ name: "First", latitude: 35.123457, longitude: -82.987654,
      sortOrder: 0, tripId, notes: input.notes });
    const second = await createStop({ name: "Second" });
    const inserted = await createStop({ name: "Inserted", sortOrder: 1 });
    let list = await request(app).get(path());
    expect(list.headers["cache-control"]).toBe("no-store");
    expect(list.body.map((s: { id: string }) => s.id)).toEqual([first.id, inserted.id, second.id]);
    expect((await request(app).get(`${path()}/${inserted.id}`)).body.id).toBe(inserted.id);
    const update = await request(app).put(`${path()}/${second.id}`).send({
      ...input, name: "Edited", latitude: -90, longitude: 180, sortOrder: 0,
      visitDate: "", stopType: " \t ", transportFromPrevious: null, notes: "\n \n",
    });
    expect(update.status).toBe(200);
    expect(update.body).toMatchObject({ sortOrder: 0, latitude: -90, longitude: 180,
      visitDate: null, stopType: null, transportFromPrevious: null, notes: null });
    list = await request(app).get(path());
    expect(list.body.map((s: { id: string }) => s.id)).toEqual([second.id, first.id, inserted.id]);
    expect((await request(app).delete(`${path()}/${first.id}`)).status).toBe(204);
    expect((await request(app).get(`${path()}/${first.id}`)).status).toBe(404);
    expect((await stored()).map((s) => s.sortOrder)).toEqual([0, 1]);
    expect(await db.select().from(trips).where(eq(trips.id, tripId))).toEqual(parentBefore);
  });

  it("User B cannot access or change User A stops, even with known trip and stop UUIDs", async () => {
    const aTrip = tripId;
    const aUser = userId;
    const a = await createStop();
    const another = await createStop({ name: "Another" });
    const before = await stored();
    await signIn();
    const bTrip = await createTrip();
    const attempts = [
      request(app).get(path()),
      request(app).post(path()).send(input),
      request(app).get(`${path()}/${a.id}`),
      request(app).put(`${path()}/${a.id}`).send({ ...input, name: "Unauthorized" }),
      request(app).delete(`${path()}/${a.id}`),
      request(app).put(`${path()}/order`).send({ stopIds: [another.id, a.id] }),
    ];
    // Sequential requests keep the external mock identity stable and expose
    // the first precise denial failure in the controlled red evidence.
    for (const attempt of attempts) expect((await attempt).status).toBe(404);
    for (const method of ["get", "put", "delete"] as const) {
      const call = request(app)[method](`/api/trips/${bTrip}/stops/${a.id}`);
      const response = await (method === "put" ? call.send(input) : call);
      expect(response.status).toBe(404);
    }
    const crossOrder = await request(app).put(`/api/trips/${bTrip}/stops/order`).send({ stopIds: [a.id] });
    expect(crossOrder.status).toBe(409);
    expect(await stored()).toEqual(before);
    expect((await db.select().from(trips).where(and(eq(trips.id, aTrip), eq(trips.userId, aUser))))).toHaveLength(1);
  });
  it("rejects every unauthenticated operation and forged owner header", async () => {
    const stop = await createStop();
    const before = await stored();
    clerk.userId = null;
    const calls = [
      request(app).get(path()).set("X-User-Id", userId), request(app).post(path()).send(input),
      request(app).get(`${path()}/${stop.id}`), request(app).put(`${path()}/${stop.id}`).send(input),
      request(app).delete(`${path()}/${stop.id}`), request(app).put(`${path()}/order`).send({ stopIds: [stop.id] }),
    ];
    for (const call of calls) expect((await call).status).toBe(401);
    expect(await stored()).toEqual(before);
  });
  it("reorders exactly, persists reload order, and deterministically compacts equal legacy positions", async () => {
    const a = await createStop({ name: "A" });
    const b = await createStop({ name: "B" });
    const c = await createStop({ name: "C" });
    await db.update(stops).set({ sortOrder: 9 }).where(eq(stops.tripId, tripId));
    const tied = await request(app).get(path());
    expect(tied.body.map((s: { id: string }) => s.id)).toEqual([a.id, b.id, c.id].sort());
    const response = await request(app).put(`${path()}/order`).send({ stopIds: [c.id, a.id, b.id] });
    expect(response.status).toBe(200);
    expect(response.body.map((s: { id: string }) => s.id)).toEqual([c.id, a.id, b.id]);
    expect((await request(app).get(path())).body.map((s: { sortOrder: number }) => s.sortOrder)).toEqual([0, 1, 2]);
  });
  it("serializes concurrent appends and concurrent complete reorder operations", async () => {
    const results = await Promise.all(["A", "B", "C"].map((name) => request(app).post(path()).send({ ...input, name })));
    expect(results.map((r) => r.status)).toEqual([201, 201, 201]);
    const rows = await stored();
    expect(rows.map((r) => r.sortOrder)).toEqual([0, 1, 2]);
    const ids = rows.map((r) => r.id), reversed = [...ids].reverse();
    const reordered = await Promise.all([ids, reversed].map((stopIds) => request(app).put(`${path()}/order`).send({ stopIds })));
    expect(reordered.map((r) => r.status)).toEqual([200, 200]);
    const final = await stored();
    expect([ids, reversed]).toContainEqual(final.map((r) => r.id));
    expect(final.map((r) => r.sortOrder)).toEqual([0, 1, 2]);
  });
  it("rejects stale, duplicate, unknown and foreign order IDs without partial writes", async () => {
    const a = await createStop(), b = await createStop();
    const before = await stored();
    for (const [stopIds, status] of [
      [[a.id], 409], [[a.id, a.id], 400], [[a.id, randomUUID()], 409], [[b.id, "invalid"], 400],
    ] as [string[], number][]) {
      expect((await request(app).put(`${path()}/order`).send({ stopIds })).status).toBe(status);
      expect(await stored()).toEqual(before);
    }
  });
  it("supports empty itineraries, empty reorder, and deletion of a trip with its stops", async () => {
    expect((await request(app).get(path())).body).toEqual([]);
    expect((await request(app).put(`${path()}/order`).send({ stopIds: [] })).body).toEqual([]);
    const stop = await createStop();
    expect((await request(app).delete(`/api/trips/${tripId}`)).status).toBe(204);
    expect(await db.select().from(stops).where(eq(stops.id, stop.id))).toEqual([]);
    expect((await request(app).get(path())).status).toBe(404);
  });
  it.each([
    { latitude: -90.000001 }, { latitude: 90.000001 }, { longitude: -180.000001 }, { longitude: 180.000001 },
    { latitude: "35" }, { longitude: null }, { name: " \t " }, { name: "x".repeat(201) },
    { name: "bad\0name" }, { notes: "bad\0notes" }, { visitDate: "1900-02-29" },
    { visitDate: "0000-01-01" }, { visitDate: "2024-02-29T00:00:00Z" },
    { sortOrder: -1 }, { sortOrder: 0.5 }, { sortOrder: 2147483648 }, { sortOrder: 100 },
    { stopType: "x".repeat(101) }, { notes: "x".repeat(20001) },
    { transportFromPrevious: "Walking" }, { tripId: randomUUID() }, { userId: randomUUID() },
    { id: randomUUID() }, { createdAt: "2026-01-01" },
  ])("rejects invalid stop input without adding or damaging rows %#", async (bad) => {
    const stop = await createStop();
    const before = await stored();
    for (const response of [
      await request(app).post(path()).send({ ...input, ...bad }),
      await request(app).put(`${path()}/${stop.id}`).send({ ...input, ...bad }),
    ]) {
      expect(response.status).toBe(400);
      expect(typeof response.body.error).toBe("string");
    }
    expect(await stored()).toEqual(before);
  });
  it("handles missing fields, wrong root types, malformed JSON, media types and UUIDs safely", async () => {
    const stop = await createStop();
    const before = await stored();
    for (const body of ["{}", "[]", "null", '{"name":']) {
      expect((await request(app).put(`${path()}/${stop.id}`).set("Content-Type", "application/json").send(body)).status).toBe(400);
    }
    expect((await request(app).post(path()).type("form").send({ name: "no" })).status).toBe(415);
    expect((await request(app).get("/api/trips/not-a-uuid/stops")).status).toBe(400);
    expect((await request(app).get(`${path()}/not-a-uuid`)).status).toBe(400);
    expect((await request(app).get(`${path()}/${randomUUID()}`)).status).toBe(404);
    expect((await request(app).get(`/api/trips/${randomUUID()}/stops`)).status).toBe(404);
    expect(await stored()).toEqual(before);
  });
  it("accepts exact boundaries, supported modes, null optionals and six-decimal storage", async () => {
    for (const transport of ["Driving", "Flying", "Other", null]) {
      const stop = await createStop({ name: "x".repeat(200), latitude: 90, longitude: -180,
        visitDate: "0001-01-01", stopType: "x".repeat(100), notes: "🌲".repeat(10000), transportFromPrevious: transport });
      expect(stop).toMatchObject({ latitude: 90, longitude: -180, transportFromPrevious: transport, visitDate: "0001-01-01" });
    }
  });
});
