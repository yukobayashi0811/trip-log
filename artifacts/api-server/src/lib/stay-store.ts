import { and, eq } from "drizzle-orm";
import { db, stays, stops, trips } from "@workspace/db";
import type { stayInputSchema } from "@workspace/api-zod";
import { stayResponseSchema } from "@workspace/api-zod";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Input = ReturnType<typeof stayInputSchema.parse>;
type Row = typeof stays.$inferSelect;

export class StayRequestError extends Error {
  constructor(public status: number, message: string, public fields?: Record<string, string[]>) {
    super(message);
  }
}

const response = (row: Row) => stayResponseSchema.parse(row);

// Lock the owned trip and stop before touching stays. Stop and trip deletion
// uses the same parent lock, so the ownership chain stays stable for writes.
async function inOwnedStop<T>(
  userId: string, tripId: string, stopId: string, action: (tx: Transaction) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    const [trip] = await tx.select({ id: trips.id }).from(trips)
      .where(and(eq(trips.id, tripId), eq(trips.userId, userId))).for("update");
    if (!trip) throw new StayRequestError(404, "Trip not found.");
    const [stop] = await tx.select({ id: stops.id }).from(stops)
      .where(and(eq(stops.id, stopId), eq(stops.tripId, tripId))).for("update");
    if (!stop) throw new StayRequestError(404, "Stop not found.");
    return action(tx);
  });
}

function isUniqueViolation(error: unknown): boolean {
  return !!error && typeof error === "object" &&
    "code" in error && error.code === "23505";
}

export async function getOwnedStay(userId: string, tripId: string, stopId: string) {
  return inOwnedStop(userId, tripId, stopId, async (tx) => {
    const [row] = await tx.select().from(stays).where(eq(stays.stopId, stopId));
    if (!row) throw new StayRequestError(404, "No accommodation has been added to this stop.");
    return response(row);
  });
}

export async function createOwnedStay(userId: string, tripId: string, stopId: string, input: Input) {
  try {
    return await inOwnedStop(userId, tripId, stopId, async (tx) => {
      const [existing] = await tx.select({ id: stays.id }).from(stays).where(eq(stays.stopId, stopId));
      if (existing) throw new StayRequestError(409, "This stop already has an accommodation. Edit the existing stay instead.");
      const [row] = await tx.insert(stays).values({
        stopId,
        accommodationType: input.accommodationType,
        checkIn: input.checkIn,
        checkOut: input.checkOut,
        rating: input.rating ?? null,
        notes: input.notes ?? null,
      }).returning();
      return response(row);
    });
  } catch (error) {
    if (error instanceof StayRequestError) throw error;
    if (isUniqueViolation(error)) {
      throw new StayRequestError(409, "This stop already has an accommodation. Edit the existing stay instead.");
    }
    throw error;
  }
}

export function updateOwnedStay(userId: string, tripId: string, stopId: string, input: Input) {
  return inOwnedStop(userId, tripId, stopId, async (tx) => {
    const [row] = await tx.update(stays).set({
      accommodationType: input.accommodationType,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      rating: input.rating ?? null,
      notes: input.notes ?? null,
    }).where(eq(stays.stopId, stopId)).returning();
    if (!row) throw new StayRequestError(404, "Accommodation no longer exists on this stop.");
    return response(row);
  });
}

export async function deleteOwnedStay(userId: string, tripId: string, stopId: string): Promise<void> {
  await inOwnedStop(userId, tripId, stopId, async (tx) => {
    const [row] = await tx.delete(stays).where(eq(stays.stopId, stopId)).returning({ id: stays.id });
    if (!row) throw new StayRequestError(404, "Accommodation no longer exists on this stop.");
  });
}
