import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db, pool, users } from "@workspace/db";

const clerk = vi.hoisted(() => ({
  userId: null as string | null,
  getUser: vi.fn(),
}));

// Only the external identity provider is mocked. Requests use the real Express
// middleware/router and the real development PostgreSQL unique constraint.
vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  getAuth: () => ({ userId: clerk.userId }),
  clerkClient: { users: { getUser: clerk.getUser } },
}));

import app from "../app";

const createdIds: string[] = [];
function identity(email = "auth-test@example.invalid") {
  const id = `test_auth_${randomUUID()}`;
  createdIds.push(id);
  clerk.userId = id;
  clerk.getUser.mockResolvedValue({
    id,
    primaryEmailAddressId: "email_primary",
    emailAddresses: [{
      id: "email_primary",
      emailAddress: email,
      verification: { status: "verified" },
    }],
  });
  return id;
}

beforeEach(() => {
  clerk.userId = null;
  clerk.getUser.mockReset();
});

afterAll(async () => {
  if (createdIds.length) {
    await db.delete(users).where(inArray(users.clerkUserId, createdIds));
  }
  await pool.end();
});

describe("authentication foundation", () => {
  it("rejects unauthenticated requests without provisioning a user", async () => {
    const response = await request(app).get("/api/auth/me");
    expect(response.status).toBe(401);
    expect(response.body.error).toBeTruthy();
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(clerk.getUser).not.toHaveBeenCalled();
  });

  it("ignores forged identity headers and query parameters", async () => {
    const response = await request(app)
      .get("/api/auth/me?userId=someone-else&email=attacker@example.invalid")
      .set("X-User-Id", "someone-else");
    expect(response.status).toBe(401);
  });

  it("creates the internal account with a database-generated UUID", async () => {
    const id = identity();
    const response = await request(app).get("/api/auth/me");
    expect(response.status).toBe(200);
    expect(response.body.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(response.body.email).toBe("auth-test@example.invalid");
    expect(response.body.createdAt).toBeTruthy();
    expect(response.body).not.toHaveProperty("clerkUserId");
    expect(clerk.getUser).toHaveBeenCalledWith(id);
    const rows = await db.select().from(users).where(eq(users.clerkUserId, id));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(response.body.id);
  });

  it("concurrent synchronization never creates duplicates", async () => {
    const id = identity();
    const responses = await Promise.all(
      Array.from({ length: 8 }, () => request(app).get("/api/auth/me")),
    );
    expect(responses.every((response) => response.status === 200)).toBe(true);
    expect(new Set(responses.map((response) => response.body.id)).size).toBe(1);
    const rows = await db.select().from(users).where(eq(users.clerkUserId, id));
    expect(rows).toHaveLength(1);
  });

  it("synchronizes verified email changes while preserving internal identity", async () => {
    const id = identity();
    const first = await request(app).get("/api/auth/me");
    clerk.getUser.mockResolvedValue({
      id, primaryEmailAddressId: "new",
      emailAddresses: [{ id: "new", emailAddress: "updated@example.invalid",
        verification: { status: "verified" } }],
    });
    const second = await request(app).get("/api/auth/me");
    expect(second.status).toBe(200);
    expect(second.body.id).toBe(first.body.id);
    expect(second.body.email).toBe("updated@example.invalid");
  });

  it("resolves distinct internal IDs even for identities sharing an email", async () => {
    identity();
    const first = await request(app).get("/api/auth/me");
    identity();
    const second = await request(app).get("/api/auth/me?userId=" + first.body.id);
    expect(second.status).toBe(200);
    expect(second.body.id).not.toBe(first.body.id);
  });

  it("fails closed when Clerk is unavailable without exposing details", async () => {
    const id = identity();
    clerk.getUser.mockRejectedValue(new Error("sensitive-provider-message"));
    const response = await request(app).get("/api/auth/me");
    expect(response.status).toBe(503);
    expect(JSON.stringify(response.body)).not.toContain("sensitive-provider-message");
    expect(await db.select().from(users).where(eq(users.clerkUserId, id))).toHaveLength(0);
  });

  it("does not provision accounts without a verified primary email", async () => {
    const id = identity();
    clerk.getUser.mockResolvedValue({
      id, primaryEmailAddressId: "pending",
      emailAddresses: [{ id: "pending", emailAddress: "unverified@example.invalid",
        verification: { status: "unverified" } }],
    });
    const response = await request(app).get("/api/auth/me");
    expect(response.status).toBe(503);
    expect(await db.select().from(users).where(eq(users.clerkUserId, id))).toHaveLength(0);
  });

  it("returns to unauthorized state once the session is absent", async () => {
    identity();
    expect((await request(app).get("/api/auth/me")).status).toBe(200);
    clerk.userId = null;
    expect((await request(app).get("/api/auth/me")).status).toBe(401);
  });
});
