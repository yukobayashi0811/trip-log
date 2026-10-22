import { sql } from "drizzle-orm";
import { check, date, integer, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import type { z } from "zod/v4";
import { stops } from "./stops";

export const accommodationTypes = ["Hotel", "Campground", "Vacation Rental", "Other"] as const;

export const stays = pgTable("stays", {
  id: uuid("id").primaryKey().defaultRandom(),
  stopId: uuid("stop_id").notNull().unique().references(() => stops.id, { onDelete: "cascade" }),
  accommodationType: text("accommodation_type", { enum: accommodationTypes }).notNull(),
  checkIn: date("check_in", { mode: "string" }).notNull(),
  checkOut: date("check_out", { mode: "string" }).notNull(),
  rating: integer("rating"),
  notes: text("notes"),
}, (table) => [
  check("stays_dates_ordered", sql`${table.checkOut} > ${table.checkIn}`),
  check("stays_rating_range", sql`${table.rating} BETWEEN 1 AND 5`),
  check("stays_type_allowed", sql`${table.accommodationType} IN ('Hotel', 'Campground', 'Vacation Rental', 'Other')`),
]);

export const insertStaySchema = createInsertSchema(stays).omit({ id: true });
export type InsertStay = z.infer<typeof insertStaySchema>;
export type Stay = typeof stays.$inferSelect;
