import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import { db, pool, stays, stops, trips, users } from "@workspace/db";
import { isStayCalendarDate } from "@workspace/api-zod";

const clerk = vi.hoisted(() => ({ userId: null as string | null, getUser: vi.fn() }));
vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  getAuth: () => ({ userId: clerk.userId }),
  clerkClient: { users: { getUser: clerk.getUser } },
}));
import app from "../app";

const identities: string[] = [];
const stopInput = {
  name: "Stay fixture",
  latitude: 35.123456,
  longitude: -82.987654,
  visitDate: null,
};
const validStay = {
  accommodationType: "Hotel",
  checkIn: "2010-02-28",
  checkOut: "2010-03-01",
};
let tripId: string;
let stopId: string;
let userId: string;
const path = (trip = tripId, stop = stopId) => `/api/trips/${trip}/stops/${stop}/stay`;

async function signIn() {
  const id = `test_auth_stay_${randomUUID()}`;
  identities.push(id);
  clerk.userId = id;
  clerk.getUser.mockResolvedValue({
    id,
    primaryEmailAddressId: "primary",
    emailAddresses: [{ id: "primary", emailAddress: "stay-test@example.invalid", verification: { status: "verified" } }],
  });
  const response = await request(app).get("/api/auth/me");
  expect(response.status).toBe(200);
  return response.body.id as string;
}

async function createTrip() {
  const response = await request(app).post("/api/trips").send({
    title: "Stay test trip",
    startDate: "2024-02-28",
    endDate: "2024-03-02",
  });
  expect(response.status).toBe(201);
  return response.body.id as string;
}

async function createStop(name = stopInput.name, parentTrip = tripId) {
  const response = await request(app).post(`/api/trips/${parentTrip}/stops`).send({ ...stopInput, name });
  expect(response.status).toBe(201);
  return response.body.id as string;
}

const stored = () => db.select().from(stays).where(eq(stays.stopId, stopId));

beforeEach(async () => {
  userId = await signIn();
  tripId = await createTrip();
  stopId = await createStop();
});

afterAll(async () => {
  if (identities.length) await db.delete(users).where(inArray(users.clerkUserId, identities));
  await pool.end();
});

describe("owned accommodation stays on real PostgreSQL", () => {
  it("creates, reads after reload, updates, deletes, and leaves its stop and trip intact", async () => {
    expect((await request(app).get(path())).status).toBe(404);
    const created = await request(app).post(path()).send({
      ...validStay,
      accommodationType: "Hotel",
      rating: 5,
      notes: "  Near the station  ",
    });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      stopId,
      accommodationType: "Hotel",
      checkIn: "2010-02-28",
      checkOut: "2010-03-01",
      rating: 5,
      notes: "  Near the station  ",
    });

    const [storedAfterCreate] = await stored();
    expect(storedAfterCreate).toMatchObject({ id: created.body.id, stopId, rating: 5 });
    expect((await request(app).get(path())).body).toEqual(created.body);
    for (const read of [
      await request(app).get(`/api/trips/${tripId}/stops/${stopId}`),
      await request(app).get(`/api/trips/${tripId}/stops`),
    ]) {
      expect(read.status).toBe(200);
      const stop = Array.isArray(read.body) ? read.body.find((item: { id: string }) => item.id === stopId) : read.body;
      expect(stop.stay).toEqual(created.body);
    }

    const updated = await request(app).put(path()).send({
      accommodationType: "Vacation Rental",
      checkIn: "2010-03-02",
      checkOut: "2010-03-05",
      rating: null,
      notes: " \n\t ",
    });
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({
      id: created.body.id,
      stopId,
      accommodationType: "Vacation Rental",
      checkIn: "2010-03-02",
      checkOut: "2010-03-05",
      rating: null,
      notes: null,
    });
    expect((await request(app).get(path())).body).toEqual(updated.body);

    expect((await request(app).delete(path())).status).toBe(204);
    expect((await request(app).get(path())).status).toBe(404);
    expect(await stored()).toHaveLength(0);
    const stop = await db.select().from(stops).where(and(eq(stops.id, stopId), eq(stops.tripId, tripId)));
    const trip = await db.select().from(trips).where(and(eq(trips.id, tripId), eq(trips.userId, userId)));
    expect(stop).toHaveLength(1);
    expect(trip).toHaveLength(1);
    expect((await request(app).get(`/api/trips/${tripId}/stops/${stopId}`)).body.stay).toBeNull();
  });

  it.each(["Hotel", "Campground", "Vacation Rental", "Other"])("accepts the approved accommodation type %s", async (accommodationType) => {
    const response = await request(app).post(path()).send({ ...validStay, accommodationType });
    expect(response.status).toBe(201);
    expect(response.body.accommodationType).toBe(accommodationType);
  });

  it("accepts rating boundaries and leap-day dates without restricting stays to the trip dates", async () => {
    const outsideTrip = await request(app).post(path()).send({
      ...validStay, rating: 1,
    });
    expect(outsideTrip.status).toBe(201);
    expect(outsideTrip.body).toMatchObject({
      checkIn: "2010-02-28",
      checkOut: "2010-03-01",
      rating: 1,
    });

    const leapStop = await createStop("Leap-day stay");
    const leapDay = await request(app).post(path(tripId, leapStop)).send({
      accommodationType: "Other",
      checkIn: "2024-02-29",
      checkOut: "2024-03-01",
      rating: 5,
    });
    expect(leapDay.status).toBe(201);
    expect(leapDay.body).toMatchObject({ checkIn: "2024-02-29", checkOut: "2024-03-01", rating: 5 });
  });

  it("rejects year 0000 as a validation error before reaching PostgreSQL", async () => {
    expect(isStayCalendarDate("0000-02-29")).toBe(false);
    expect(isStayCalendarDate("0001-01-01")).toBe(true);

    const response = await request(app).post(path()).send({
      ...validStay,
      checkIn: "0000-02-29",
    });
    expect(response.status).toBe(400);
    expect(response.body.fields.checkIn).toContain("Enter a real check-in date in YYYY-MM-DD format.");
    expect(await stored()).toHaveLength(0);
  });

  it("keeps stays separate per stop, rejects a second stay on one stop, and preserves the first record", async () => {
    const first = await request(app).post(path()).send(validStay);
    expect(first.status).toBe(201);
    const secondAttempt = await request(app).post(path()).send({ ...validStay, accommodationType: "Other" });
    expect(secondAttempt.status).toBe(409);
    expect((await request(app).get(path())).body).toEqual(first.body);

    const secondStop = await createStop("Second stay fixture");
    const otherStay = await request(app).post(path(tripId, secondStop)).send({
      ...validStay, accommodationType: "Campground",
    });
    expect(otherStay.status).toBe(201);
    const list = await request(app).get(`/api/trips/${tripId}/stops`);
    expect(list.body.filter((stop: { stay: unknown }) => stop.stay !== null)).toHaveLength(2);
  });

  it("rejects invalid dates, ordering, types, ratings, shapes, and unknown fields without overwriting saved data", async () => {
    const created = await request(app).post(path()).send(validStay);
    expect(created.status).toBe(201);
    const before = await stored();
    const invalid = [
      {},
      { ...validStay, checkIn: "2024-02-30" },
      { ...validStay, checkOut: "2010-02-28" },
      { ...validStay, checkOut: "2010-02-27" },
      { ...validStay, accommodationType: "Hostel" },
      { ...validStay, rating: 0 },
      { ...validStay, rating: 6 },
      { ...validStay, rating: 1.5 },
      { ...validStay, rating: "5" },
      { ...validStay, notes: 17 },
      { ...validStay, ownerId: userId },
    ];
    for (const payload of invalid) {
      const response = await request(app).post(path()).send(payload);
      expect(response.status).toBe(400);
      expect(response.body.error).toBeTruthy();
    }
    const malformed = await request(app).post(path()).set("Content-Type", "application/json").send("null");
    expect(malformed.status).toBe(400);
    const invalidUpdate = await request(app).put(path()).send({ ...validStay, checkOut: "2010-02-27" });
    expect(invalidUpdate.status).toBe(400);
    expect(invalidUpdate.body.fields.checkOut).toContain("Check-out must be later than check-in.");
    expect(await stored()).toEqual(before);
    expect((await request(app).get(path())).body).toEqual(created.body);
    const malformedJson = await request(app).post(path()).set("Content-Type", "application/json").send('{"checkIn":');
    expect(malformedJson.status).toBe(400);
  });

  it("blocks User B from reading, creating, updating, or deleting User A's known stay", async () => {
    const created = await request(app).post(path()).send({ ...validStay, notes: "Owner A only" });
    expect(created.status).toBe(201);
    const originalRows = await stored();
    const ownerTrip = tripId;
    const ownerStop = stopId;
    await signIn();
    const bTrip = await createTrip();
    const bStop = await createStop("User B stop", bTrip);

    expect((await request(app).get(path(ownerTrip, ownerStop))).status).toBe(404);
    expect((await request(app).post(path(ownerTrip, ownerStop)).send(validStay)).status).toBe(404);
    expect((await request(app).put(path(ownerTrip, ownerStop)).send({
      ...validStay, accommodationType: "Other",
    })).status).toBe(404);
    expect((await request(app).delete(path(ownerTrip, ownerStop))).status).toBe(404);
    expect((await request(app).get(path(bTrip, ownerStop))).status).toBe(404);
    expect((await request(app).put(path(bTrip, ownerStop)).send(validStay)).status).toBe(404);
    expect((await request(app).delete(path(bTrip, ownerStop))).status).toBe(404);
    expect((await request(app).post(path(bTrip, ownerStop)).send(validStay)).status).toBe(404);
    expect((await request(app).get(path(bTrip, bStop))).status).toBe(404);

    expect(await stored()).toEqual(originalRows);
    expect((await request(app).get(`/api/trips/${ownerTrip}/stops/${ownerStop}`)).status).toBe(404);
  });

  it("requires a verified session and ignores forged owner headers", async () => {
    const created = await request(app).post(path()).send(validStay);
    expect(created.status).toBe(201);
    const before = await stored();
    clerk.userId = null;
    expect((await request(app).get(path()).set("X-User-Id", userId)).status).toBe(401);
    expect((await request(app).post(path()).send(validStay)).status).toBe(401);
    expect((await request(app).put(path()).send(validStay)).status).toBe(401);
    expect((await request(app).delete(path())).status).toBe(401);
    expect(await stored()).toEqual(before);
  });

  it("removes a stay when its stop is deleted", async () => {
    expect((await request(app).post(path()).send(validStay)).status).toBe(201);
    expect((await request(app).delete(`/api/trips/${tripId}/stops/${stopId}`)).status).toBe(204);
    expect(await stored()).toHaveLength(0);
  });
});
