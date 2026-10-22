import { index, pgTable, primaryKey, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import type { z } from "zod/v4";
import { users } from "./users";
import { trips } from "./trips";

export const stars = pgTable("stars", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tripId: uuid("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.userId, table.tripId] }),
  index("stars_trip_id_idx").on(table.tripId),
]);

export const insertStarSchema = createInsertSchema(stars).omit({ createdAt: true });
export type InsertStar = z.infer<typeof insertStarSchema>;
export type Star = typeof stars.$inferSelect;
