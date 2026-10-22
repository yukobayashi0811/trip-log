import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { pool, users, trips, stops, stays, stars, type PoolClient } from "@workspace/db";
import * as schema from "@workspace/db/schema";

let client: PoolClient;
let database: NodePgDatabase<typeof schema>;
let originalAccounts: { id: string; clerk_user_id: string }[] = [];

beforeAll(async () => {
  // Exclude the concurrently running authentication suite's own temporary rows.
  const result = await pool.query(
    "SELECT id, clerk_user_id FROM users WHERE clerk_user_id NOT LIKE 'test_auth_%' ORDER BY id",
  );
  originalAccounts = result.rows;
});
beforeEach(async () => {
  client = await pool.connect();
  await client.query("BEGIN");
  database = drizzle(client, { schema });
});
afterEach(async () => {
  try {
    await client.query("ROLLBACK");
  } finally {
    client.release();
  }
});
afterAll(async () => {
  try {
    if (originalAccounts.length) {
      const current = await pool.query(
        "SELECT id, clerk_user_id FROM users WHERE id = ANY($1::uuid[]) ORDER BY id",
        [originalAccounts.map((account) => account.id)],
      );
      // Boolean comparison avoids exposing real account details on assertion failure.
      expect(JSON.stringify(current.rows) === JSON.stringify(originalAccounts)).toBe(true);
    }
  } finally {
    await pool.end();
  }
});

async function graph() {
  const [user] = await database.insert(users).values({
    clerkUserId: `test_db_${randomUUID()}`,
    email: "database-test@example.invalid",
  }).returning();
  const [trip] = await database.insert(trips).values({
    userId: user!.id, title: "Synthetic schema test",
    startDate: "2026-01-01", endDate: "2026-01-03",
  }).returning();
  const [stop] = await database.insert(stops).values({
    tripId: trip!.id, name: "Synthetic test stop",
    latitude: "0.000000", longitude: "0.000000", sortOrder: 0,
  }).returning();
  const [stay] = await database.insert(stays).values({
    stopId: stop!.id, accommodationType: "Hotel",
    checkIn: "2026-01-01", checkOut: "2026-01-02",
  }).returning();
  const [star] = await database.insert(stars).values({
    userId: user!.id, tripId: trip!.id,
  }).returning();
  return { user: user!, trip: trip!, stop: stop!, stay: stay!, star: star! };
}

// PostgreSQL aborts a transaction after a constraint violation. A savepoint
// keeps each expected rejection isolated, and allows subsequent assertions.
async function rejected(statement: string, params: unknown[], code: string) {
  await client.query("SAVEPOINT invalid_record");
  let actualCode: string | undefined;
  try {
    await client.query(statement, params);
  } catch (error) {
    actualCode = (error as { code?: string }).code;
  } finally {
    await client.query("ROLLBACK TO SAVEPOINT invalid_record");
    await client.query("RELEASE SAVEPOINT invalid_record");
  }
  expect(actualCode).toBe(code);
}

describe("relational database foundation (real PostgreSQL)", () => {
  it("matches every approved column, type and nullability in all five tables", async () => {
    const expected: Record<string, string[]> = {
      users: ["id:uuid:NO", "clerk_user_id:text:NO", "email:text:NO", "created_at:timestamp with time zone:NO"],
      trips: ["id:uuid:NO", "user_id:uuid:NO", "title:text:NO", "start_date:date:NO", "end_date:date:NO",
        "destination_region:text:YES", "trip_type:text:YES", "notes:text:YES", "created_at:timestamp with time zone:NO"],
      stops: ["id:uuid:NO", "trip_id:uuid:NO", "name:text:NO", "latitude:numeric:NO", "longitude:numeric:NO",
        "visit_date:date:YES", "sort_order:integer:NO", "stop_type:text:YES", "transport_from_previous:text:YES", "notes:text:YES"],
      stays: ["id:uuid:NO", "stop_id:uuid:NO", "accommodation_type:text:NO", "check_in:date:NO",
        "check_out:date:NO", "rating:integer:YES", "notes:text:YES"],
      stars: ["user_id:uuid:NO", "trip_id:uuid:NO", "created_at:timestamp with time zone:NO"],
    };
    const result = await client.query(
      `SELECT table_name, column_name, data_type, is_nullable, column_default,
              numeric_precision, numeric_scale
         FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = ANY($1::text[])
        ORDER BY table_name, ordinal_position`, [Object.keys(expected)],
    );
    for (const [table, columns] of Object.entries(expected)) {
      const actual = result.rows.filter((row) => row.table_name === table);
      expect(actual.map((row) => `${row.column_name}:${row.data_type}:${row.is_nullable}`).sort())
        .toEqual([...columns].sort());
      for (const row of actual) {
        if (row.column_name === "id") expect(row.column_default).toContain("gen_random_uuid()");
        if (row.column_name === "created_at") expect(row.column_default).toContain("now()");
        if (["latitude", "longitude"].includes(row.column_name)) {
          expect([row.numeric_precision, row.numeric_scale]).toEqual([9, 6]);
        }
      }
    }
  });

  it("has the composite stars primary key and the intended foreign keys/cascades", async () => {
    const keys = await client.query(
      `SELECT conrelid::regclass::text AS source, confrelid::regclass::text AS target,
              confdeltype AS deletion
         FROM pg_constraint
        WHERE contype = 'f' AND connamespace = 'public'::regnamespace
          AND conrelid::regclass::text = ANY($1::text[])`,
      [["trips", "stops", "stays", "stars"]],
    );
    expect(keys.rows.map((row) => `${row.source}->${row.target}:${row.deletion}`).sort()).toEqual([
      "trips->users:c", "stops->trips:c", "stays->stops:c", "stars->users:c", "stars->trips:c",
    ].sort());
    const pk = await client.query(
      `SELECT a.attname FROM pg_constraint c
       JOIN LATERAL unnest(c.conkey) WITH ORDINALITY k(attnum, position) ON true
       JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
       WHERE c.conrelid = 'public.stars'::regclass AND c.contype = 'p'
       ORDER BY k.position`,
    );
    expect(pk.rows.map((row) => row.attname)).toEqual(["user_id", "trip_id"]);
  });

  it("indexes owner/date, stop order, and both star lookup directions", async () => {
    const result = await client.query(
      "SELECT indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename = ANY($1::text[])",
      [["trips", "stops", "stays", "stars"]],
    );
    const definitions = result.rows.map((row) => row.indexdef).join("\n");
    for (const columns of ["(user_id, start_date)", "(trip_id, sort_order)", "(stop_id)", "(user_id, trip_id)", "(trip_id)"]) {
      expect(definitions).toContain(columns);
    }
  });

  it("creates a complete graph with generated IDs, defaults, nullable fields and date-only values", async () => {
    const records = await graph();
    for (const record of [records.user, records.trip, records.stop, records.stay]) {
      expect(record.id).toMatch(/^[0-9a-f-]{36}$/);
    }
    expect(records.trip.createdAt).toBeInstanceOf(Date);
    expect(records.star.createdAt).toBeInstanceOf(Date);
    expect(records.trip.startDate).toBe("2026-01-01");
    expect(records.trip.notes).toBeNull();
    expect(records.stop.visitDate).toBeNull();
    expect(records.stop.latitude).toBe("0.000000");
    expect(records.stay.rating).toBeNull();
    const linked = await database.query.users.findFirst({
      where: eq(users.id, records.user.id),
      with: { trips: { with: { stops: { with: { stay: true } }, stars: true } }, stars: true },
    });
    expect(linked?.trips[0]?.stops[0]?.stay?.id).toBe(records.stay.id);
    expect(linked?.stars[0]?.tripId).toBe(records.trip.id);
  });

  it("supports multiple trips and stops, optional fields and boundary values", async () => {
    const records = await graph();
    await database.insert(trips).values({
      userId: records.user.id, title: "Another synthetic test",
      startDate: "2026-02-01", endDate: "2026-02-01",
      destinationRegion: "Test region", tripType: "Test type", notes: "Temporary",
    });
    for (const [order, mode] of ["Driving", "Flying", "Other"].entries()) {
      await database.insert(stops).values({
        tripId: records.trip.id, name: "Boundary test", latitude: order ? "-90" : "90",
        longitude: order ? "-180" : "180", sortOrder: order,
        visitDate: "2026-01-01", stopType: "Test", transportFromPrevious: mode as "Driving" | "Flying" | "Other",
      });
    }
    expect(await database.select().from(trips).where(eq(trips.userId, records.user.id))).toHaveLength(2);
    expect(await database.select().from(stops).where(eq(stops.tripId, records.trip.id))).toHaveLength(4);
  });

  it.each([
    ["trip owner", "INSERT INTO trips (user_id,title,start_date,end_date) VALUES ($1,'Test','2026-01-01','2026-01-01')"],
    ["stop trip", "INSERT INTO stops (trip_id,name,latitude,longitude,sort_order) VALUES ($1,'Test',0,0,0)"],
    ["stay stop", "INSERT INTO stays (stop_id,accommodation_type,check_in,check_out) VALUES ($1,'Hotel','2026-01-01','2026-01-02')"],
  ])("rejects a missing %s", async (_name, statement) => {
    await rejected(statement, [randomUUID()], "23503");
  });

  it("rejects invalid star user/trip references", async () => {
    const { user, trip } = await graph();
    await rejected("INSERT INTO stars (user_id,trip_id) VALUES ($1,$2)", [randomUUID(), trip.id], "23503");
    await rejected("INSERT INTO stars (user_id,trip_id) VALUES ($1,$2)", [user.id, randomUUID()], "23503");
  });

  it("rejects duplicate stars and a second stay for the same stop", async () => {
    const { user, trip, stop } = await graph();
    await rejected("INSERT INTO stars (user_id,trip_id) VALUES ($1,$2)", [user.id, trip.id], "23505");
    await rejected(
      "INSERT INTO stays (stop_id,accommodation_type,check_in,check_out) VALUES ($1,'Other','2026-02-01','2026-02-02')",
      [stop.id], "23505",
    );
  });

  it("rejects blank titles/names, backwards dates, coordinates, order, and unknown transport", async () => {
    const { trip, stop } = await graph();
    for (const value of ["", "   ", "\t\n"]) {
      await rejected("UPDATE trips SET title=$1 WHERE id=$2", [value, trip.id], "23514");
      await rejected("UPDATE stops SET name=$1 WHERE id=$2", [value, stop.id], "23514");
    }
    await rejected("UPDATE trips SET end_date='2025-12-31' WHERE id=$1", [trip.id], "23514");
    for (const value of ["90.000001", "-90.000001", "NaN"]) {
      await rejected("UPDATE stops SET latitude=$1 WHERE id=$2", [value, stop.id], "23514");
    }
    for (const value of ["180.000001", "-180.000001"]) {
      await rejected("UPDATE stops SET longitude=$1 WHERE id=$2", [value, stop.id], "23514");
    }
    await rejected("UPDATE stops SET sort_order=-1 WHERE id=$1", [stop.id], "23514");
    await rejected("UPDATE stops SET transport_from_previous='Teleport' WHERE id=$1", [stop.id], "23514");
    await rejected("UPDATE trips SET title=NULL WHERE id=$1", [trip.id], "23502");
  });

  it("enforces stay dates, integer ratings and allowed accommodation types", async () => {
    const { stay } = await graph();
    for (const value of ["2025-12-31", "2026-01-01"]) {
      await rejected("UPDATE stays SET check_out=$1 WHERE id=$2", [value, stay.id], "23514");
    }
    for (const rating of [0, 6]) {
      await rejected("UPDATE stays SET rating=$1 WHERE id=$2", [rating, stay.id], "23514");
    }
    await rejected("UPDATE stays SET accommodation_type='Castle' WHERE id=$1", [stay.id], "23514");
    for (const type of ["Hotel", "Campground", "Vacation Rental", "Other"]) {
      await client.query("UPDATE stays SET accommodation_type=$1, rating=5 WHERE id=$2", [type, stay.id]);
    }
  });

  it("deleting a stay leaves its stop, trip and user intact", async () => {
    const { stay, stop, trip, user } = await graph();
    await database.delete(stays).where(eq(stays.id, stay.id));
    expect(await database.select().from(stays).where(eq(stays.id, stay.id))).toHaveLength(0);
    expect(await database.select().from(stops).where(eq(stops.id, stop.id))).toHaveLength(1);
    expect(await database.select().from(trips).where(eq(trips.id, trip.id))).toHaveLength(1);
    expect(await database.select().from(users).where(eq(users.id, user.id))).toHaveLength(1);
  });

  it("deleting a stop cascades only its stay", async () => {
    const { stop, stay, trip, user } = await graph();
    await database.delete(stops).where(eq(stops.id, stop.id));
    expect(await database.select().from(stays).where(eq(stays.id, stay.id))).toHaveLength(0);
    expect(await database.select().from(trips).where(eq(trips.id, trip.id))).toHaveLength(1);
    expect(await database.select().from(stars).where(eq(stars.tripId, trip.id))).toHaveLength(1);
    expect(await database.select().from(users).where(eq(users.id, user.id))).toHaveLength(1);
  });

  it("deleting a trip cascades stops, stays and stars without affecting unrelated records", async () => {
    const target = await graph();
    const unrelated = await graph();
    await database.delete(trips).where(eq(trips.id, target.trip.id));
    expect(await database.select().from(stops).where(eq(stops.tripId, target.trip.id))).toHaveLength(0);
    expect(await database.select().from(stays).where(eq(stays.id, target.stay.id))).toHaveLength(0);
    expect(await database.select().from(stars).where(eq(stars.tripId, target.trip.id))).toHaveLength(0);
    expect(await database.select().from(users).where(eq(users.id, target.user.id))).toHaveLength(1);
    expect(await database.select().from(stays).where(eq(stays.id, unrelated.stay.id))).toHaveLength(1);
  });

  it("deleting a temporary user cascades their journal, leaving other accounts intact", async () => {
    const target = await graph();
    const unrelated = await graph();
    await database.delete(users).where(eq(users.id, target.user.id));
    expect(await database.select().from(trips).where(eq(trips.userId, target.user.id))).toHaveLength(0);
    expect(await database.select().from(stops).where(eq(stops.id, target.stop.id))).toHaveLength(0);
    expect(await database.select().from(stays).where(eq(stays.id, target.stay.id))).toHaveLength(0);
    expect(await database.select().from(stars).where(eq(stars.userId, target.user.id))).toHaveLength(0);
    expect(await database.select().from(users).where(eq(users.id, unrelated.user.id))).toHaveLength(1);
  });
});
