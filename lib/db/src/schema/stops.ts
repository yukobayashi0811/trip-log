import { sql } from "drizzle-orm";
import { check, date, index, integer, numeric, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import type { z } from "zod/v4";
import { trips } from "./trips";

export const transportModes = ["Driving", "Flying", "Other"] as const;

export const stops = pgTable("stops", {
  id: uuid("id").primaryKey().defaultRandom(),
  tripId: uuid("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  latitude: numeric("latitude", { precision: 9, scale: 6 }).notNull(),
  longitude: numeric("longitude", { precision: 9, scale: 6 }).notNull(),
  visitDate: date("visit_date", { mode: "string" }),
  sortOrder: integer("sort_order").notNull(),
  stopType: text("stop_type"),
  transportFromPrevious: text("transport_from_previous", { enum: transportModes }),
  notes: text("notes"),
}, (table) => [
  check("stops_name_nonblank", sql`${table.name} ~ '[^[:space:]]'`),
  check("stops_latitude_range", sql`${table.latitude} BETWEEN -90 AND 90`),
  check("stops_longitude_range", sql`${table.longitude} BETWEEN -180 AND 180`),
  check("stops_order_nonnegative", sql`${table.sortOrder} >= 0`),
  check("stops_transport_allowed", sql`${table.transportFromPrevious} IN ('Driving', 'Flying', 'Other')`),
  // Not unique: equal positions may exist temporarily during atomic reordering.
  index("stops_trip_sort_order_idx").on(table.tripId, table.sortOrder),
]);

export const insertStopSchema = createInsertSchema(stops).omit({ id: true });
export type InsertStop = z.infer<typeof insertStopSchema>;
export type Stop = typeof stops.$inferSelect;
