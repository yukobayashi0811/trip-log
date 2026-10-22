import { and, asc, eq } from "drizzle-orm";
import { db, stops, trips } from "@workspace/db";
import type { stopInputSchema } from "@workspace/api-zod";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Input = ReturnType<typeof stopInputSchema.parse>;
type Row = typeof stops.$inferSelect;
export class StopRequestError extends Error {
  constructor(public status: number, message: string, public fields?: Record<string, string[]>) { super(message); }
}
export const stopResponse = (row: Row) => ({
  ...row, latitude: Number(row.latitude), longitude: Number(row.longitude),
});

// Every operation locks the OWNED parent first. Stop mutations on the same trip
// serialize with one another and with parent updates/deletion. No schema change.
async function inOwnedTrip<T>(userId: string, tripId: string, action: (tx: Transaction) => Promise<T>) {
  return db.transaction(async (tx) => {
    const [parent] = await tx.select({ id: trips.id }).from(trips)
      .where(and(eq(trips.id, tripId), eq(trips.userId, userId))).for("update");
    if (!parent) throw new StopRequestError(404, "Trip not found.");
    return action(tx);
  });
}
const orderedRows = (tx: Transaction, tripId: string) => tx.select().from(stops)
  .where(eq(stops.tripId, tripId)).orderBy(asc(stops.sortOrder), asc(stops.id));
async function setOrder(tx: Transaction, tripId: string, ids: string[]) {
  // All callers hold the same parent lock; either every position commits or none.
  for (const [sortOrder, id] of ids.entries()) {
    await tx.update(stops).set({ sortOrder }).where(and(eq(stops.id, id), eq(stops.tripId, tripId)));
  }
}
function position(value: number | undefined, fallback: number, maximum: number) {
  const result = value ?? fallback;
  if (result > maximum) throw new StopRequestError(400, "Choose a valid itinerary position.", {
    sortOrder: [`Position must be between 0 and ${maximum}. Reload the itinerary and try again.`],
  });
  return result;
}
function writable(input: Input) {
  const { sortOrder: _sortOrder, latitude, longitude, ...rest } = input;
  return { ...rest, latitude: latitude.toFixed(6), longitude: longitude.toFixed(6) };
}
export const listOwnedStops = (userId: string, tripId: string) =>
  inOwnedTrip(userId, tripId, async (tx) => (await orderedRows(tx, tripId)).map(stopResponse));
export const getOwnedStop = (userId: string, tripId: string, stopId: string) =>
  inOwnedTrip(userId, tripId, async (tx) => {
    const [row] = await tx.select().from(stops).where(and(eq(stops.tripId, tripId), eq(stops.id, stopId)));
    if (!row) throw new StopRequestError(404, "Stop not found.");
    return stopResponse(row);
  });
export const createOwnedStop = (userId: string, tripId: string, input: Input) =>
  inOwnedTrip(userId, tripId, async (tx) => {
    const rows = await orderedRows(tx, tripId);
    const target = position(input.sortOrder, rows.length, rows.length);
    const [row] = await tx.insert(stops).values({ ...writable(input), tripId, sortOrder: target }).returning();
    const ids = rows.map((item) => item.id);
    ids.splice(target, 0, row.id);
    await setOrder(tx, tripId, ids);
    return stopResponse(row);
  });
export const updateOwnedStop = (userId: string, tripId: string, stopId: string, input: Input) =>
  inOwnedTrip(userId, tripId, async (tx) => {
    const rows = await orderedRows(tx, tripId);
    const current = rows.findIndex((row) => row.id === stopId);
    if (current < 0) throw new StopRequestError(404, "Stop not found.");
    const target = position(input.sortOrder, current, rows.length - 1);
    const [row] = await tx.update(stops).set({ ...writable(input), sortOrder: target })
      .where(and(eq(stops.tripId, tripId), eq(stops.id, stopId))).returning();
    const ids = rows.filter((item) => item.id !== stopId).map((item) => item.id);
    ids.splice(target, 0, stopId);
    await setOrder(tx, tripId, ids);
    return stopResponse(row);
  });
export const deleteOwnedStop = (userId: string, tripId: string, stopId: string) =>
  inOwnedTrip(userId, tripId, async (tx) => {
    const [row] = await tx.delete(stops).where(and(eq(stops.tripId, tripId), eq(stops.id, stopId))).returning();
    if (!row) throw new StopRequestError(404, "Stop not found.");
    await setOrder(tx, tripId, (await orderedRows(tx, tripId)).map((item) => item.id));
  });
export const reorderOwnedStops = (userId: string, tripId: string, stopIds: string[]) =>
  inOwnedTrip(userId, tripId, async (tx) => {
    const rows = await orderedRows(tx, tripId);
    const current = new Set(rows.map((row) => row.id));
    if (stopIds.length !== current.size || stopIds.some((id) => !current.has(id))) {
      throw new StopRequestError(409, "The stops changed. Reload the itinerary before reordering.");
    }
    await setOrder(tx, tripId, stopIds);
    return (await orderedRows(tx, tripId)).map(stopResponse);
  });
