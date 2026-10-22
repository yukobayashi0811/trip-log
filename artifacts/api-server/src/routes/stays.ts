import { Router, type Request, type NextFunction } from "express";
import { stayInputSchema, stayValidationError, tripIdSchema } from "@workspace/api-zod";
import { requireUser } from "../middlewares/require-user";
import {
  createOwnedStay, deleteOwnedStay, getOwnedStay, StayRequestError, updateOwnedStay,
} from "../lib/stay-store";

const router = Router();
const path = "/trips/:tripId/stops/:stopId/stay";
router.use(path, requireUser);

const guarded = (handler: (req: Request, res: Parameters<Parameters<typeof router.get>[1]>[1]) => Promise<void>) =>
  async (req: Request, res: Parameters<Parameters<typeof router.get>[1]>[1], next: NextFunction): Promise<void> => {
    const trip = tripIdSchema.safeParse(req.params.tripId);
    const stop = tripIdSchema.safeParse(req.params.stopId);
    if (!trip.success || !stop.success) {
      res.status(400).json({ error: "Open a valid trip and stop from your itinerary." });
      return;
    }
    if (["POST", "PUT"].includes(req.method) &&
      req.get("Content-Type")?.split(";")[0]?.trim().toLowerCase() !== "application/json") {
      res.status(415).json({ error: "Send accommodation details as application/json." });
      return;
    }
    try {
      await handler(req, res);
    } catch (error) {
      if (error instanceof StayRequestError) {
        res.status(error.status).json({
          error: error.message,
          ...(error.fields ? { fields: error.fields } : {}),
        });
      } else next(error);
    }
  };

function parseStayBody(req: Request, res: Parameters<Parameters<typeof router.get>[1]>[1]) {
  const result = stayInputSchema.safeParse(req.body);
  if (!result.success) {
    const detail = stayValidationError(result.error);
    res.status(400).json(detail);
    return null;
  }
  return result.data;
}

const tripId = (req: Request) => req.params.tripId as string;
const stopId = (req: Request) => req.params.stopId as string;

router.get(path, guarded(async (req, res) => {
  res.json(await getOwnedStay(res.locals.user.id, tripId(req), stopId(req)));
}));

router.post(path, guarded(async (req, res) => {
  const input = parseStayBody(req, res);
  if (!input) return;
  res.status(201).json(await createOwnedStay(res.locals.user.id, tripId(req), stopId(req), input));
}));

router.put(path, guarded(async (req, res) => {
  const input = parseStayBody(req, res);
  if (!input) return;
  res.json(await updateOwnedStay(res.locals.user.id, tripId(req), stopId(req), input));
}));

router.delete(path, guarded(async (req, res) => {
  await deleteOwnedStay(res.locals.user.id, tripId(req), stopId(req));
  res.status(204).end();
}));

export default router;
