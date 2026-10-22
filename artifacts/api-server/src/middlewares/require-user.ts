import { getAuth } from "@clerk/express";
import type { RequestHandler } from "express";
import type { User } from "@workspace/db";
import { synchronizeUser } from "../lib/user-sync";

declare global {
  namespace Express {
    interface Locals {
      user: User;
    }
  }
}

// All future private routers must mount this guard. Downstream ownership queries
// use res.locals.user.id, never client-supplied user IDs or email addresses.
export const requireUser: RequestHandler = async (req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Please sign in to continue." });
    return;
  }
  try {
    res.locals.user = await synchronizeUser(userId);
    next();
  } catch {
    // Do not log Clerk profile payloads, session tokens, or database errors
    // that may contain account details.
    req.log.warn("Account synchronization unavailable");
    res.status(503).json({
      error: "We couldn't prepare your account. Please try again shortly.",
    });
  }
};
