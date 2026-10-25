import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { inArray } from "drizzle-orm";
import { db, pool, stars, stays, stops, trips, users } from "@workspace/db";

const clerk = vi.hoisted(() => ({ userId: null as string | null, getUser: vi.fn() }));
vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  getAuth: () => ({ userId: clerk.userId }),
  clerkClient: { users: { getUser: clerk.getUser } },
}));
import app from "../app";

const identities: string[] = [];
async function signIn() {
  const id = `test_dashboard_${randomUUID()}`;
  identities.push(id);
  clerk.userId = id;
  clerk.getUser.mockResolvedValue({
    id, primaryEmailAddressId: "primary",
    emailAddresses: [{ id: "primary", emailAddress: "dashboard@example.invalid", verification: { status: "verified" } }],
  });
  const response = await request(app).get("/api/auth/me");
  expect(response.status).toBe(200);
  return { clerkId: id, userId: response.body.id as string };
}
async function addTrip(userId: string, startDate = "2026-03-07") {
  const [trip] = await db.insert(trips).values({
    userId, title: "Synthetic dashboard test", startDate, endDate: "2027-12-31",
  }).returning();
  return trip;
}
async function addStop(tripId: string, sortOrder: number) {
  const [stop] = await db.insert(stops).values({
    tripId, name: "Synthetic stop", latitude: "35", longitude: "-120", sortOrder,
  }).returning();
  return stop;
}
async function addStay(stopId: string, checkIn: string, checkOut: string) {
  return db.insert(stays).values({ stopId, accommodationType: "Hotel", checkIn, checkOut });
}
beforeEach(() => { clerk.userId = null; clerk.getUser.mockReset(); });
afterAll(async () => {
  if (identities.length) await db.delete(users).where(inArray(users.clerkUserId, identities));
  await pool.end();
});

describe("Dashboard aggregates against PostgreSQL", () => {
  it("requires authentication", async () => {
    expect((await request(app).get("/api/dashboard")).status).toBe(401);
  });

  it("returns honest zeros and no months for an empty journal", async () => {
    await signIn();
    const response = await request(app).get("/api/dashboard");
    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.body).toEqual({
      totalTrips: 0, totalStops: 0, totalAccommodationNights: 0, tripsByMonth: [],
    });
  });

  it("Test B: two stays equal exactly three nights despite other users, extra stops and stars", async () => {
    const a = await signIn();
    const t1 = await addTrip(a.userId);
    const t2 = await addTrip(a.userId, "2027-01-01");
    const s1 = await addStop(t1.id, 0);
    const s2 = await addStop(t1.id, 1);
    await addStop(t1.id, 2); // no stay; must not multiply trips or nights
    await addStop(t2.id, 0);
    await addStay(s1.id, "2026-03-07", "2026-03-09"); // 2 calendar nights, spring DST
    await addStay(s2.id, "2026-11-01", "2026-11-02"); // 1 calendar night, fall DST
    await db.insert(stars).values([
      { userId: a.userId, tripId: t1.id }, { userId: a.userId, tripId: t2.id },
    ]);
    const b = await signIn();
    const otherTrip = await addTrip(b.userId);
    const otherStop = await addStop(otherTrip.id, 0);
    await addStay(otherStop.id, "2026-03-01", "2026-03-11"); // excluded 10 nights
    await db.insert(stars).values([
      { userId: b.userId, tripId: otherTrip.id },
      // Defensive legacy fixture: this is not permitted by the star API.
      { userId: b.userId, tripId: t1.id },
    ]);
    clerk.userId = a.clerkId;
    const response = await request(app).get(`/api/dashboard?userId=${b.userId}`);
    expect(response.status).toBe(200);
    expect(response.body.totalAccommodationNights).toBe(3);
    expect(response.body).toEqual({
      totalTrips: 2, totalStops: 4, totalAccommodationNights: 3,
      tripsByMonth: [{ month: "2026-03", tripCount: 1 }, { month: "2027-01", tripCount: 1 }],
    });
    clerk.userId = b.clerkId;
    expect((await request(app).get("/api/dashboard")).body).toEqual({
      totalTrips: 1, totalStops: 1, totalAccommodationNights: 10,
      tripsByMonth: [{ month: "2026-03", tripCount: 1 }],
    });
  });

  it("groups trip START dates chronologically by month AND year, not trip end dates", async () => {
    const a = await signIn();
    for (const date of ["2027-01-01", "2026-12-31", "2026-01-01", "2026-01-31"]) await addTrip(a.userId, date);
    expect((await request(app).get("/api/dashboard")).body.tripsByMonth).toEqual([
      { month: "2026-01", tripCount: 2 }, { month: "2026-12", tripCount: 1 }, { month: "2027-01", tripCount: 1 },
    ]);
  });

  it("counts leap-day and year-boundary stays using date subtraction", async () => {
    const a = await signIn();
    const trip = await addTrip(a.userId, "2024-01-01");
    const s1 = await addStop(trip.id, 0);
    const s2 = await addStop(trip.id, 1);
    await addStay(s1.id, "2024-02-28", "2024-03-01"); // 2
    await addStay(s2.id, "2025-12-31", "2026-01-01"); // 1
    expect((await request(app).get("/api/dashboard")).body.totalAccommodationNights).toBe(3);
  });

  it("refreshes after stay edits/deletion and cascading trip deletion", async () => {
    const a = await signIn();
    const trip = await addTrip(a.userId);
    const stop = await addStop(trip.id, 0);
    await addStay(stop.id, "2026-03-01", "2026-03-02");
    expect((await request(app).get("/api/dashboard")).body.totalAccommodationNights).toBe(1);
    expect((await request(app).put(`/api/trips/${trip.id}/stops/${stop.id}/stay`).send({
      accommodationType: "Hotel", checkIn: "2026-03-01", checkOut: "2026-03-04",
    })).status).toBe(200);
    expect((await request(app).get("/api/dashboard")).body.totalAccommodationNights).toBe(3);
    expect((await request(app).delete(`/api/trips/${trip.id}/stops/${stop.id}/stay`)).status).toBe(204);
    expect((await request(app).get("/api/dashboard")).body).toMatchObject({ totalTrips: 1, totalStops: 1, totalAccommodationNights: 0 });
    expect((await request(app).delete(`/api/trips/${trip.id}`)).status).toBe(204);
    expect((await request(app).get("/api/dashboard")).body).toEqual({
      totalTrips: 0, totalStops: 0, totalAccommodationNights: 0, tripsByMonth: [],
    });
  });

  it("returns a safe error instead of partial/zero totals on database failure", async () => {
    await signIn();
    const query = vi.spyOn(db, "execute").mockRejectedValueOnce(new Error("private database detail"));
    try {
      const response = await request(app).get("/api/dashboard");
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: "Something went wrong. Please try again." });
    } finally { query.mockRestore(); }
  });
});
