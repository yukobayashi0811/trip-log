import { relations } from "drizzle-orm";
import { users } from "./users";
import { trips } from "./trips";
import { stops } from "./stops";
import { stays } from "./stays";
import { stars } from "./stars";

export const usersRelations = relations(users, ({ many }) => ({
  trips: many(trips),
  stars: many(stars),
}));
export const tripsRelations = relations(trips, ({ one, many }) => ({
  user: one(users, { fields: [trips.userId], references: [users.id] }),
  stops: many(stops),
  stars: many(stars),
}));
export const stopsRelations = relations(stops, ({ one }) => ({
  trip: one(trips, { fields: [stops.tripId], references: [trips.id] }),
  stay: one(stays),
}));
export const staysRelations = relations(stays, ({ one }) => ({
  stop: one(stops, { fields: [stays.stopId], references: [stops.id] }),
}));
export const starsRelations = relations(stars, ({ one }) => ({
  user: one(users, { fields: [stars.userId], references: [users.id] }),
  trip: one(trips, { fields: [stars.tripId], references: [trips.id] }),
}));
