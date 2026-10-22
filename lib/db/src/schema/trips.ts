import { sql } from "drizzle-orm";
import { check, date, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import type { z } from "zod/v4";
import { users } from "./users";

export const trips = pgTable("trips", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  startDate: date("start_date", { mode: "string" }).notNull(),
  endDate: date("end_date", { mode: "string" }).notNull(),
  destinationRegion: text("destination_region"),
  tripType: text("trip_type"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check("trips_title_nonblank", sql`${table.title} ~ '[^[:space:]]'`),
  check("trips_dates_ordered", sql`${table.endDate} >= ${table.startDate}`),
  index("trips_user_start_date_idx").on(table.userId, table.startDate),
]);

// Persistence schema, not a public API input contract. Future handlers must
// derive userId from the authenticated internal account, never from client input.
export const insertTripSchema = createInsertSchema(trips).omit({ id: true, createdAt: true });
export type InsertTrip = z.infer<typeof insertTripSchema>;
export type Trip = typeof trips.$inferSelect;
