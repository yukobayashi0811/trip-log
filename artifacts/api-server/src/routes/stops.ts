import { Router, type Request, type Response, type NextFunction } from "express";
import { tripIdSchema, stopInputSchema, stopOrderSchema, stopValidationError } from "@workspace/api-zod";
import { requireUser } from "../middlewares/require-user";
import { createOwnedStop, deleteOwnedStop, getOwnedStop, listOwnedStops, reorderOwnedStops,
  StopRequestError, updateOwnedStop } from "../lib/stop-store";

const router = Router();
router.use("/trips/:tripId/stops", requireUser);
const guarded = (handler: (req: Request, res: Response) => Promise<void>) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!tripIdSchema.safeParse(req.params.tripId).success ||
      (req.params.stopId !== undefined && !tripIdSchema.safeParse(req.params.stopId).success)) {
      res.status(400).json({ error: "Open a valid trip and stop from your itinerary." }); return;
    }
    if (["POST", "PUT"].includes(req.method) &&
      req.get("Content-Type")?.split(";")[0]?.trim().toLowerCase() !== "application/json") {
      res.status(415).json({ error: "Send stop details as application/json." }); return;
    }
    try { await handler(req, res); } catch (error) {
      if (error instanceof StopRequestError) {
        res.status(error.status).json({ error: error.message, ...(error.fields ? { fields: error.fields } : {}) });
      } else next(error);
    }
  };
const tripId = (req: Request) => req.params.tripId as string;
const stopId = (req: Request) => req.params.stopId as string;
router.get("/trips/:tripId/stops", guarded(async (req, res) => {
  res.json(await listOwnedStops(res.locals.user.id, tripId(req)));
}));
router.post("/trips/:tripId/stops", guarded(async (req, res) => {
  const input = stopInputSchema.safeParse(req.body);
  if (!input.success) { res.status(400).json(stopValidationError(input.error)); return; }
  res.status(201).json(await createOwnedStop(res.locals.user.id, tripId(req), input.data));
}));
router.put("/trips/:tripId/stops/order", guarded(async (req, res) => {
  const input = stopOrderSchema.safeParse(req.body);
  if (!input.success) { res.status(400).json(stopValidationError(input.error)); return; }
  res.json(await reorderOwnedStops(res.locals.user.id, tripId(req), input.data.stopIds));
}));
router.get("/trips/:tripId/stops/:stopId", guarded(async (req, res) => {
  res.json(await getOwnedStop(res.locals.user.id, tripId(req), stopId(req)));
}));
router.put("/trips/:tripId/stops/:stopId", guarded(async (req, res) => {
  const input = stopInputSchema.safeParse(req.body);
  if (!input.success) { res.status(400).json(stopValidationError(input.error)); return; }
  res.json(await updateOwnedStop(res.locals.user.id, tripId(req), stopId(req), input.data));
}));
router.delete("/trips/:tripId/stops/:stopId", guarded(async (req, res) => {
  await deleteOwnedStop(res.locals.user.id, tripId(req), stopId(req)); res.status(204).end();
}));
export default router;
