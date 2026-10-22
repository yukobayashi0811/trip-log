import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db, pool, trips, users } from "@workspace/db";
import { tripFormErrors, TRIP_LIMITS } from "@workspace/api-zod";

const clerk = vi.hoisted(() => ({ userId: null as string | null, getUser: vi.fn() }));
vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  getAuth: () => ({ userId: clerk.userId }),
  clerkClient: { users: { getUser: clerk.getUser } },
}));
import app from "../app";
const identities: string[] = [];
const valid = { title: "Validation fixture", startDate: "2026-01-01", endDate: "2026-01-02",
  destinationRegion: "Keep region", tripType: "Keep type", notes: "Keep notes" };
let tripId: string;
beforeEach(async () => {
  const id = `test_auth_validation_${randomUUID()}`;
  identities.push(id); clerk.userId = id;
  clerk.getUser.mockResolvedValue({
    id, primaryEmailAddressId: "primary",
    emailAddresses: [{ id: "primary", emailAddress: "validation@example.invalid", verification: { status: "verified" } }],
  });
  const trip = await request(app).post("/api/trips").send(valid);
  expect(trip.status).toBe(201);
  tripId = trip.body.id;
});
afterAll(async () => {
  if (identities.length) await db.delete(users).where(inArray(users.clerkUserId, identities));
  await pool.end();
});
async function stored() { return db.select().from(trips).where(eq(trips.id, tripId)); }

describe("validation errors and preservation through real HTTP/Drizzle/PostgreSQL", () => {
  it.each([
    { title: " \t " }, { startDate: "1900-02-29" }, { endDate: "2025-12-31" },
    { notes: "unsafe\0text" }, { destinationRegion: { secret: "never echo" } },
    { title: "x".repeat(TRIP_LIMITS.title + 1) },
  ])("returns shared actionable field messages without changing or adding records %#", async (bad) => {
    const before = await stored();
    const payload = { ...valid, ...bad };
    const clientErrors = tripFormErrors(payload);
    const create = await request(app).post("/api/trips").send(payload);
    const update = await request(app).put(`/api/trips/${tripId}`).send(payload);
    for (const response of [create, update]) {
      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Check the highlighted fields and try again.");
      expect(response.body.formErrors).toEqual([]);
      for (const [field, message] of Object.entries(clientErrors)) expect(response.body.fields[field][0]).toBe(message);
      expect(JSON.stringify(response.body)).not.toContain("never echo");
    }
    expect(await stored()).toEqual(before);
    expect((await request(app).get("/api/trips")).body).toHaveLength(1);
  });
  it("accepts exact limits without truncation, date extremes, and preserves note whitespace", async () => {
    const notes = `\n${"x".repeat(TRIP_LIMITS.notes - 2)}\n`;
    const payload = { title: "x".repeat(TRIP_LIMITS.title), startDate: "0001-01-01", endDate: "9999-12-31",
      destinationRegion: "x".repeat(TRIP_LIMITS.destinationRegion), tripType: "x".repeat(TRIP_LIMITS.tripType), notes };
    const response = await request(app).put(`/api/trips/${tripId}`).send(payload);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject(payload);
    expect((await request(app).get(`/api/trips/${tripId}`)).body).toMatchObject(payload);
  });
  it("clears optional whitespace fields without changing title or dates", async () => {
    const response = await request(app).put(`/api/trips/${tripId}`).send({
      ...valid, destinationRegion: " \t ", tripType: "", notes: "\n \n",
    });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ ...valid, destinationRegion: null, tripType: null, notes: null });
  });
  it.each(["[]", "{}", "null", '"string"', '{"title":'])("safely rejects malformed/root body %s and preserves the record", async (body) => {
    const before = await stored();
    const response = await request(app).put(`/api/trips/${tripId}`).set("Content-Type", "application/json").send(body);
    expect(response.status).toBe(400);
    expect(typeof response.body.error).toBe("string");
    expect(JSON.stringify(response.body)).not.toContain("SyntaxError");
    expect(await stored()).toEqual(before);
  });
  it.each(["text/plain", "application/x-www-form-urlencoded"])("rejects %s with 415 after auth, without writes", async (contentType) => {
    const before = await stored();
    const response = await request(app).put(`/api/trips/${tripId}`).set("Content-Type", contentType).send("title=wrong");
    expect(response.status).toBe(415);
    expect(response.body.error).toContain("application/json");
    expect(await stored()).toEqual(before);
    clerk.userId = null;
    expect((await request(app).post("/api/trips").set("Content-Type", contentType).send("title=wrong")).status).toBe(401);
  });
  it("rejects unknown metadata with safe root errors and no mutation", async () => {
    const before = await stored();
    const response = await request(app).put(`/api/trips/${tripId}`).send({ ...valid, userId: randomUUID() });
    expect(response.status).toBe(400);
    expect(response.body.fields).toEqual({});
    expect(response.body.formErrors).toHaveLength(1);
    expect(response.body.error).toContain("Only editable trip fields");
    expect(await stored()).toEqual(before);
  });
  it.each([
    ["Content-Type", "application/json; charset=iso-8859-1"],
    ["Content-Encoding", "compress"],
  ])("safely rejects unsupported %s without a server error or data loss", async (header, value) => {
    const before = await stored();
    const response = await request(app).put(`/api/trips/${tripId}`)
      .set("Content-Type", "application/json").set(header, value).send(JSON.stringify(valid));
    expect(response.status).toBe(415);
    expect(response.body.error).toContain("UTF-8");
    expect(await stored()).toEqual(before);
  });
});
