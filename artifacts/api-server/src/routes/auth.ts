import { Router } from "express";
import { GetCurrentUserResponse } from "@workspace/api-zod";
import { requireUser } from "../middlewares/require-user";

const router = Router();
router.get("/auth/me", requireUser, (_req, res) => {
  const user = res.locals.user;
  res.json(GetCurrentUserResponse.parse({
    id: user.id,
    email: user.email,
    createdAt: user.createdAt.toISOString(),
  }));
});
export default router;
