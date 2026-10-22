import { Router } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db, trips } from "@workspace/db";
import { tripIdSchema, tripInputSchema, tripValidationError } from "@workspace/api-zod";
import { requireUser } from "../middlewares/require-user";

const router = Router();
router.use("/trips", requireUser);
router.use("/trips", (req, res, next) => {
  const mediaType = req.get("Content-Type")?.split(";")[0]?.trim().toLowerCase();
  if ((req.method === "POST" || req.method === "PUT") && mediaType !== "application/json") {
    res.status(415).json({ error: "Send trip details as application/json. Use the trip form and try again." });
    return;
  }
  next();
});

const fields = {
  id: trips.id, title: trips.title, startDate: trips.startDate,
  endDate: trips.endDate, destinationRegion: trips.destinationRegion,
  tripType: trips.tripType, notes: trips.notes, createdAt: trips.createdAt,
};

// The SAME predicate scopes reads and atomic UPDATE/DELETE statements.
// Never substitute a client-supplied owner or look up by ID alone.
const ownedTrip = (id: string, userId: string) =>
  and(eq(trips.id, id), eq(trips.userId, userId));

router.get("/trips", async (_req, res) => {
  const rows = await db.select(fields).from(trips)
    .where(eq(trips.userId, res.locals.user.id))
    .orderBy(desc(trips.startDate), desc(trips.createdAt), desc(trips.id));
  res.json(rows);
});

router.post("/trips", async (req, res) => {
  const input = tripInputSchema.safeParse(req.body);
  if (!input.success) {
    res.status(400).json(tripValidationError(input.error));
    return;
  }
  const [trip] = await db.insert(trips).values({
    ...input.data, userId: res.locals.user.id,
  }).returning(fields);
  res.status(201).json(trip);
});

router.get("/trips/:id", async (req, res) => {
  const id = tripIdSchema.safeParse(req.params.id);
  if (!id.success) { res.status(400).json({ error: "Invalid trip ID." }); return; }
  const [trip] = await db.select(fields).from(trips)
    .where(ownedTrip(id.data, res.locals.user.id));
  if (!trip) { res.status(404).json({ error: "Trip not found." }); return; }
  res.json(trip);
});

router.put("/trips/:id", async (req, res) => {
  const id = tripIdSchema.safeParse(req.params.id);
  if (!id.success) { res.status(400).json({ error: "Invalid trip ID." }); return; }
  const input = tripInputSchema.safeParse(req.body);
  if (!input.success) {
    res.status(400).json(tripValidationError(input.error));
    return;
  }
  const [trip] = await db.update(trips).set(input.data)
    .where(ownedTrip(id.data, res.locals.user.id)).returning(fields);
  if (!trip) { res.status(404).json({ error: "Trip not found." }); return; }
  res.json(trip);
});

router.delete("/trips/:id", async (req, res) => {
  const id = tripIdSchema.safeParse(req.params.id);
  if (!id.success) { res.status(400).json({ error: "Invalid trip ID." }); return; }
  const [trip] = await db.delete(trips)
    .where(ownedTrip(id.data, res.locals.user.id)).returning({ id: trips.id });
  if (!trip) { res.status(404).json({ error: "Trip not found." }); return; }
  res.status(204).end();
});

export default router;
