import { Router } from "express";
import { GetTripRoutesParams, GetTripRoutesResponse } from "@workspace/api-zod";
import { requireUser } from "../middlewares/require-user";
import { listOwnedStops, StopRequestError } from "../lib/stop-store";
import { estimateOwnedRoads } from "../lib/road-routing";

const router = Router();
router.get("/trips/:tripId/routes", requireUser, async (req, res, next): Promise<void> => {
  const parsed = GetTripRoutesParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: "Open a valid trip to estimate its driving routes." }); return; }
  try {
    const userId = res.locals.user.id;
    // The saved owned snapshot is the ONLY source of coordinates/modes.
    // Authorization runs before key lookup, provider calls and cache access.
    const rows = await listOwnedStops(userId, parsed.data.tripId);
    const result = await estimateOwnedRoads(`${userId}/${parsed.data.tripId}`, parsed.data.tripId, rows);
    res.json(GetTripRoutesResponse.parse(result));
  } catch (error) {
    if (error instanceof StopRequestError) res.status(error.status).json({ error: error.message });
    else next(error);
  }
});
export default router;
