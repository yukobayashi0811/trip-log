import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db, pool, stars, stays, stops, trips, users } from "@workspace/db";

const clerk = vi.hoisted(() => ({
  userId: null as string | null, getUser: vi.fn(),
}));
// Only Clerk's external boundary is mocked. No repository, SQL, Express
// middleware, or HTTP response is mocked. All writes use development Postgres.
vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  getAuth: () => ({ userId: clerk.userId }),
  clerkClient: { users: { getUser: clerk.getUser } },
}));
import app from "../app";

const identities: string[] = [];
const input = {
  title: "Integration test journey", startDate: "2026-01-04", endDate: "2026-01-06",
  destinationRegion: "Test region", tripType: "Road trip", notes: "Synthetic test fixture only",
};
async function signIn() {
  // The shared account-preservation suite excludes this reserved test prefix.
  const id = `test_auth_trip_${randomUUID()}`;
  identities.push(id);
  clerk.userId = id;
  clerk.getUser.mockResolvedValue({
    id, primaryEmailAddressId: "primary",
    emailAddresses: [{ id: "primary", emailAddress: "trip-test@example.invalid",
      verification: { status: "verified" } }],
  });
  const response = await request(app).get("/api/auth/me");
  expect(response.status).toBe(200);
  return { clerkId: id, userId: response.body.id as string };
}
async function create() {
  const response = await request(app).post("/api/trips").send(input);
  expect(response.status).toBe(201);
  return response.body as { id: string; title: string };
}
beforeEach(() => { clerk.userId = null; clerk.getUser.mockReset(); });
afterAll(async () => {
  if (identities.length) await db.delete(users).where(inArray(users.clerkUserId, identities));
  await pool.end();
});

describe("trip CRUD against real PostgreSQL", () => {
  it("creates, lists, opens, edits, clears optional text, reloads, and deletes an owned trip", async () => {
    const owner = await signIn();
    const trip = await create();
    const stored = await db.select().from(trips).where(eq(trips.id, trip.id));
    expect(stored[0]?.userId).toBe(owner.userId);
    expect(trip.id).toMatch(/^[0-9a-f-]{36}$/);
    const listing = await request(app).get("/api/trips");
    expect(listing.status).toBe(200);
    expect(listing.body.map((t: { id: string }) => t.id)).toContain(trip.id);
    expect(listing.headers["cache-control"]).toBe("no-store");
    expect((await request(app).get(`/api/trips/${trip.id}`)).body).toMatchObject(input);
    const updated = await request(app).put(`/api/trips/${trip.id}`).send({
      ...input, title: "  Revised journey  ", startDate: "2024-02-29",
      destinationRegion: "", tripType: null, notes: "",
    });
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({
      title: "Revised journey", destinationRegion: null, tripType: null, notes: null,
      startDate: "2024-02-29",
    });
    expect(updated.body).not.toHaveProperty("userId");
    expect((await request(app).get(`/api/trips/${trip.id}`)).body).toEqual(updated.body);
    expect((await request(app).delete(`/api/trips/${trip.id}`)).status).toBe(204);
    expect((await request(app).get(`/api/trips/${trip.id}`)).status).toBe(404);
    expect((await request(app).get("/api/trips")).body).toEqual([]);
  });

  it("User B cannot read, update, or delete User A's trip even with its ID", async () => {
    const a = await signIn();
    const trip = await create();
    const b = await signIn();
    const ownTrip = await create();
    const list = await request(app).get("/api/trips");
    expect(list.body.map((t: { id: string }) => t.id)).toEqual([ownTrip.id]);
    const read = await request(app).get(`/api/trips/${trip.id}`);
    const update = await request(app).put(`/api/trips/${trip.id}`).send({ ...input, title: "Unauthorized change" });
    const remove = await request(app).delete(`/api/trips/${trip.id}`);
    expect({ read: read.status, update: update.status, delete: remove.status })
      .toEqual({ read: 404, update: 404, delete: 404 });
    expect(read.body).toEqual({ error: "Trip not found." });
    const [preserved] = await db.select().from(trips).where(eq(trips.id, trip.id));
    expect(preserved).toMatchObject({ userId: a.userId, title: input.title });
    expect(preserved?.userId).not.toBe(b.userId);
    expect((await db.select().from(trips).where(eq(trips.id, ownTrip.id)))).toHaveLength(1);
  });

  it("rejects every unauthenticated operation and forged identity headers without changing data", async () => {
    await signIn();
    const trip = await create();
    clerk.userId = null;
    const responses = await Promise.all([
      request(app).get("/api/trips"),
      request(app).post("/api/trips").send(input),
      request(app).get(`/api/trips/${trip.id}`).set("X-User-Id", "forged"),
      request(app).put(`/api/trips/${trip.id}`).send(input),
      request(app).delete(`/api/trips/${trip.id}`),
    ]);
    expect(responses.map((r) => r.status)).toEqual([401, 401, 401, 401, 401]);
    expect(clerk.getUser).toHaveBeenCalledTimes(2); // signIn and create, never unauthenticated requests
    expect(await db.select().from(trips).where(eq(trips.id, trip.id))).toHaveLength(1);
  });

  it("rejects forged ownership/id/timestamp fields on create and update", async () => {
    await signIn();
    const trip = await create();
    for (const extra of [{ userId: randomUUID() }, { id: randomUUID() }, { createdAt: "2020-01-01" }]) {
      expect((await request(app).post("/api/trips").send({ ...input, ...extra })).status).toBe(400);
      expect((await request(app).put(`/api/trips/${trip.id}`).send({ ...input, ...extra })).status).toBe(400);
    }
    const listing = await request(app).get("/api/trips?userId=forged");
    expect(listing.body.map((t: { id: string }) => t.id)).toEqual([trip.id]);
  });

  it.each([
    { title: " \t\n " }, { title: "x".repeat(201) }, { title: 12 },
    { startDate: "2026-02-30" }, { startDate: "2025-02-29" },
    { startDate: "2026-01-04T00:00:00Z" }, { startDate: "0000-01-01" },
    { endDate: "2026-01-03" }, { destinationRegion: "x".repeat(201) },
    { tripType: "x".repeat(101) }, { notes: "x".repeat(20001) }, { notes: 12 },
  ])("rejects invalid create/update input %# without changing the owned row", async (bad) => {
    await signIn();
    const trip = await create();
    expect((await request(app).post("/api/trips").send({ ...input, ...bad })).status).toBe(400);
    expect((await request(app).put(`/api/trips/${trip.id}`).send({ ...input, ...bad })).status).toBe(400);
    expect((await request(app).get(`/api/trips/${trip.id}`)).body).toMatchObject(input);
    expect((await request(app).get("/api/trips")).body).toHaveLength(1);
  });

  it("requires all mandatory fields, permits a one-day trip, and normalizes missing optional text", async () => {
    await signIn();
    expect((await request(app).post("/api/trips").send({})).status).toBe(400);
    const result = await request(app).post("/api/trips").send({
      title: "One-day test", startDate: "2026-04-01", endDate: "2026-04-01",
    });
    expect(result.status).toBe(201);
    expect(result.body).toMatchObject({ destinationRegion: null, tripType: null, notes: null });
  });

  it("returns 400 for malformed IDs and identical 404s for absent/unowned IDs", async () => {
    await signIn();
    for (const method of ["get", "put", "delete"] as const) {
      const bad = request(app)[method]("/api/trips/not-a-uuid");
      const missing = request(app)[method](`/api/trips/${randomUUID()}`);
      if (method === "put") { bad.send(input); missing.send(input); }
      expect((await bad).status).toBe(400);
      expect((await missing).status).toBe(404);
    }
  });

  it("uses a deterministic newest-first owner-only list", async () => {
    await signIn();
    await create();
    const earlier = await request(app).post("/api/trips").send({
      ...input, startDate: "2025-01-01", endDate: "2025-01-02",
    });
    const listing = await request(app).get("/api/trips");
    expect(listing.body.map((t: { startDate: string }) => t.startDate))
      .toEqual(["2026-01-04", "2025-01-01"]);
    expect(earlier.status).toBe(201);
  });

  it("deletes descendants via the existing cascades while preserving another trip and the user", async () => {
    const owner = await signIn();
    const trip = await create();
    const other = await create();
    const [stop] = await db.insert(stops).values({
      tripId: trip.id, name: "Synthetic stop", latitude: "0", longitude: "0", sortOrder: 0,
    }).returning();
    await db.insert(stays).values({
      stopId: stop!.id, accommodationType: "Hotel", checkIn: "2026-01-04", checkOut: "2026-01-05",
    });
    await db.insert(stars).values({ userId: owner.userId, tripId: trip.id });
    expect((await request(app).delete(`/api/trips/${trip.id}`)).status).toBe(204);
    expect(await db.select().from(stops).where(eq(stops.tripId, trip.id))).toEqual([]);
    expect(await db.select().from(stays).where(eq(stays.stopId, stop!.id))).toEqual([]);
    expect(await db.select().from(stars).where(eq(stars.tripId, trip.id))).toEqual([]);
    expect((await request(app).get(`/api/trips/${other.id}`)).status).toBe(200);
    expect(await db.select().from(users).where(eq(users.id, owner.userId))).toHaveLength(1);
  });

  it("returns safe client errors for malformed JSON and oversized payloads", async () => {
    await signIn();
    const malformed = await request(app).post("/api/trips")
      .set("Content-Type", "application/json").send('{"title":');
    expect(malformed.status).toBe(400);
    expect(malformed.body).toEqual({ error: "Send a valid JSON body." });
    const oversized = await request(app).post("/api/trips")
      .send({ ...input, notes: "x".repeat(110000) });
    expect(oversized.status).toBe(413);
    expect(oversized.body).toEqual({ error: "The request is too large." });
    expect((await request(app).get("/api/trips")).body).toEqual([]);
  });
});
