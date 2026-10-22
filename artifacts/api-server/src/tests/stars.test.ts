import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import { db, pool, stars, trips, users } from "@workspace/db";

const clerk = vi.hoisted(() => ({
  userId: null as string | null,
  getUser: vi.fn(),
}));
vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  getAuth: () => ({ userId: clerk.userId }),
  clerkClient: { users: { getUser: clerk.getUser } },
}));
import app from "../app";

const identities: string[] = [];
const tripInput = {
  title: "Synthetic star test trip",
  startDate: "2026-06-01",
  endDate: "2026-06-03",
};

async function signIn() {
  const id = `test_auth_star_${randomUUID()}`;
  identities.push(id);
  clerk.userId = id;
  clerk.getUser.mockResolvedValue({
    id,
    primaryEmailAddressId: "primary",
    emailAddresses: [{
      id: "primary",
      emailAddress: "star-test@example.invalid",
      verification: { status: "verified" },
    }],
  });
  const response = await request(app).get("/api/auth/me");
  expect(response.status).toBe(200);
  return { clerkId: id, userId: response.body.id as string };
}

async function createTrip(title = tripInput.title) {
  const response = await request(app).post("/api/trips").send({ ...tripInput, title });
  expect(response.status).toBe(201);
  return response.body as { id: string; title: string };
}

beforeEach(() => {
  clerk.userId = null;
  clerk.getUser.mockReset();
});

afterAll(async () => {
  if (identities.length) {
    await db.delete(users).where(inArray(users.clerkUserId, identities));
  }
  await pool.end();
});

describe("private trip stars against PostgreSQL", () => {
  it("stars and unstars an owned trip idempotently without duplicate rows", async () => {
    const owner = await signIn();
    const trip = await createTrip();

    expect((await request(app).put(`/api/trips/${trip.id}/star`)).status).toBe(200);
    expect((await request(app).put(`/api/trips/${trip.id}/star`)).body).toEqual({ isStarred: true });
    expect(await db.select().from(stars).where(
      and(eq(stars.userId, owner.userId), eq(stars.tripId, trip.id)),
    )).toHaveLength(1);

    expect((await request(app).delete(`/api/trips/${trip.id}/star`)).body).toEqual({ isStarred: false });
    expect((await request(app).delete(`/api/trips/${trip.id}/star`)).body).toEqual({ isStarred: false });
    expect(await db.select().from(stars).where(
      and(eq(stars.userId, owner.userId), eq(stars.tripId, trip.id)),
    )).toHaveLength(0);
  });

  it("lists saved trips and removes an unstarred trip from the favorites result", async () => {
    await signIn();
    const first = await createTrip("Favorite first");
    const second = await createTrip("Favorite second");

    await request(app).put(`/api/trips/${first.id}/star`).expect(200);
    await request(app).put(`/api/trips/${second.id}/star`).expect(200);
    const listed = await request(app).get("/api/starred-trips").expect(200);
    expect(listed.body.map((trip: { id: string }) => trip.id)).toEqual([second.id, first.id]);
    expect(listed.headers["cache-control"]).toBe("no-store");

    await request(app).delete(`/api/trips/${first.id}/star`).expect(200);
    expect((await request(app).get("/api/starred-trips")).body.map(
      (trip: { id: string }) => trip.id,
    )).toEqual([second.id]);
    await request(app).delete(`/api/trips/${second.id}/star`).expect(200);
    expect((await request(app).get("/api/starred-trips")).body).toEqual([]);
  });

  it("returns an empty list when the signed-in user has no stars", async () => {
    await signIn();
    await createTrip();
    await expect(request(app).get("/api/starred-trips").then((r) => r.body)).resolves.toEqual([]);
  });

  it("User B cannot star, unstar, list, or inspect User A's trip by known UUID", async () => {
    const userA = await signIn();
    const tripA = await createTrip();
    await request(app).put(`/api/trips/${tripA.id}/star`).expect(200);
    const [before] = await db.select().from(stars).where(eq(stars.tripId, tripA.id));

    const userB = await signIn();
    const listB = await request(app).get("/api/starred-trips").expect(200);
    const starB = await request(app)
      .put(`/api/trips/${tripA.id}/star`)
      .set("X-User-Id", userA.clerkId)
      .send({ userId: userA.userId, tripId: tripA.id });
    const unstarB = await request(app)
      .delete(`/api/trips/${tripA.id}/star`)
      .set("X-User-Id", userA.clerkId);
    const forgedList = await request(app)
      .get(`/api/starred-trips?userId=${userA.userId}`)
      .set("X-User-Id", userA.clerkId);
    expect(listB.body).toEqual([]);
    expect(forgedList.body).toEqual([]);
    expect(starB.status).toBe(404);
    expect(starB.body).toEqual({ error: "Trip not found." });
    expect(unstarB.status).toBe(404);
    expect(unstarB.body).toEqual({ error: "Trip not found." });
    expect((await request(app).get(`/api/trips/${tripA.id}`)).status).toBe(404);

    const [after] = await db.select().from(stars).where(eq(stars.tripId, tripA.id));
    const [tripAfter] = await db.select().from(trips).where(eq(trips.id, tripA.id));
    expect(after).toEqual(before);
    expect(after?.userId).toBe(userA.userId);
    expect(after?.userId).not.toBe(userB.userId);
    expect(tripAfter?.title).toBe(tripInput.title);
  });

  it("denies unauthenticated star, unstar, list and forged identity requests", async () => {
    await signIn();
    const trip = await createTrip();
    clerk.userId = null;
    const responses = await Promise.all([
      request(app).get("/api/starred-trips"),
      request(app).put(`/api/trips/${trip.id}/star`).set("X-User-Id", identities[0]!),
      request(app).delete(`/api/trips/${trip.id}/star`).set("X-User-Id", identities[0]!),
    ]);
    expect(responses.map((response) => response.status)).toEqual([401, 401, 401]);
    expect(await db.select().from(stars).where(eq(stars.tripId, trip.id))).toEqual([]);
  });

  it("rejects invalid and unknown trip IDs without changing trips or stars", async () => {
    const owner = await signIn();
    const trip = await createTrip();
    await request(app).put(`/api/trips/${trip.id}/star`).expect(200);
    const invalid = await request(app).put("/api/trips/not-a-uuid/star");
    const absentId = randomUUID();
    const absentStar = await request(app).put(`/api/trips/${absentId}/star`);
    const absentUnstar = await request(app).delete(`/api/trips/${absentId}/star`);
    expect(invalid.status).toBe(400);
    expect(absentStar.status).toBe(404);
    expect(absentUnstar.status).toBe(404);
    expect(await db.select().from(trips).where(eq(trips.id, trip.id))).toHaveLength(1);
    expect(await db.select().from(stars).where(
      and(eq(stars.userId, owner.userId), eq(stars.tripId, trip.id)),
    )).toHaveLength(1);
    expect(await db.select().from(trips).where(eq(trips.id, absentId))).toEqual([]);
  });

  it("keeps multiple users' stars private and never creates or deletes trips as a side effect", async () => {
    const firstUser = await signIn();
    const firstTrip = await createTrip("First user's trip");
    await request(app).put(`/api/trips/${firstTrip.id}/star`).expect(200);
    const secondUser = await signIn();
    const secondTrip = await createTrip("Second user's trip");
    await request(app).put(`/api/trips/${secondTrip.id}/star`).expect(200);
    const before = await db.select().from(trips).where(
      inArray(trips.id, [firstTrip.id, secondTrip.id]),
    );
    expect(before).toHaveLength(2);

    const secondList = await request(app).get("/api/starred-trips").expect(200);
    expect(secondList.body.map((trip: { id: string }) => trip.id)).toEqual([secondTrip.id]);
    await request(app).delete(`/api/trips/${secondTrip.id}/star`).expect(200);
    const after = await db.select().from(trips).where(
      inArray(trips.id, [firstTrip.id, secondTrip.id]),
    );
    expect(after).toHaveLength(2);
    expect(await db.select().from(stars).where(eq(stars.userId, firstUser.userId))).toHaveLength(1);
    expect(await db.select().from(stars).where(eq(stars.userId, secondUser.userId))).toEqual([]);
  });

  it("cascades a trip deletion to its star without affecting another trip", async () => {
    await signIn();
    const trip = await createTrip("Cascade target");
    const other = await createTrip("Keep this trip");
    await request(app).put(`/api/trips/${trip.id}/star`).expect(200);
    await request(app).delete(`/api/trips/${trip.id}`).expect(204);
    expect(await db.select().from(stars).where(eq(stars.tripId, trip.id))).toEqual([]);
    expect((await request(app).get("/api/starred-trips")).body).toEqual([]);
    expect((await request(app).get(`/api/trips/${other.id}`)).status).toBe(200);
  });
});
