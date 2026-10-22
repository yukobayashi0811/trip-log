import { and, desc, eq } from "drizzle-orm";
import { Router } from "express";
import { db, stars, trips } from "@workspace/db";
import { tripIdSchema } from "@workspace/api-zod";
import { requireUser } from "../middlewares/require-user";

const router = Router();

const tripFields = {
  id: trips.id,
  title: trips.title,
  startDate: trips.startDate,
  endDate: trips.endDate,
  destinationRegion: trips.destinationRegion,
  tripType: trips.tripType,
  notes: trips.notes,
  createdAt: trips.createdAt,
};

router.get("/starred-trips", requireUser, async (_req, res) => {
  const userId = res.locals.user.id as string;
  const rows = await db
    .select(tripFields)
    .from(stars)
    .innerJoin(
      trips,
      and(eq(stars.tripId, trips.id), eq(trips.userId, userId)),
    )
    .where(eq(stars.userId, userId))
    .orderBy(desc(trips.startDate), desc(trips.createdAt), desc(trips.id));
  res.setHeader("Cache-Control", "no-store");
  res.json(rows);
});

router.put("/trips/:tripId/star", requireUser, async (req, res, next) => {
  const parsed = tripIdSchema.safeParse(req.params.tripId);
  if (!parsed.success) {
    res.status(400).json({ error: "Open a valid trip from your journal." });
    return;
  }

  try {
    const owned = await db.transaction(async (tx) => {
      const [trip] = await tx
        .select({ id: trips.id })
        .from(trips)
        .where(
          and(
            eq(trips.id, parsed.data),
            eq(trips.userId, res.locals.user.id),
          ),
        )
        .for("update");
      if (!trip) return false;

      await tx
        .insert(stars)
        .values({ userId: res.locals.user.id, tripId: trip.id })
        .onConflictDoNothing();
      return true;
    });

    if (!owned) {
      res.status(404).json({ error: "Trip not found." });
      return;
    }
    res.setHeader("Cache-Control", "no-store");
    res.json({ isStarred: true });
  } catch (error) {
    next(error);
  }
});

router.delete("/trips/:tripId/star", requireUser, async (req, res, next) => {
  const parsed = tripIdSchema.safeParse(req.params.tripId);
  if (!parsed.success) {
    res.status(400).json({ error: "Open a valid trip from your journal." });
    return;
  }

  try {
    const owned = await db.transaction(async (tx) => {
      const [trip] = await tx
        .select({ id: trips.id })
        .from(trips)
        .where(
          and(
            eq(trips.id, parsed.data),
            eq(trips.userId, res.locals.user.id),
          ),
        )
        .for("update");
      if (!trip) return false;

      await tx
        .delete(stars)
        .where(
          and(
            eq(stars.userId, res.locals.user.id),
            eq(stars.tripId, trip.id),
          ),
        );
      return true;
    });

    if (!owned) {
      res.status(404).json({ error: "Trip not found." });
      return;
    }
    res.setHeader("Cache-Control", "no-store");
    res.json({ isStarred: false });
  } catch (error) {
    next(error);
  }
});

export default router;
