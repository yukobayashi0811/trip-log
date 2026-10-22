import { sql } from "drizzle-orm";
import { Router } from "express";
import { db } from "@workspace/db";
import { requireUser } from "../middlewares/require-user";

const router = Router();

router.get("/dashboard", requireUser, async (_req, res) => {
  // One PostgreSQL statement gives all metrics the same snapshot. Each total
  // aggregates at its own grain, rather than multiplying rows in a wide join.
  // PostgreSQL DATE - DATE is an integer day count, independent of DST/timezone.
  const result = await db.execute<{
    totalTrips: number;
    totalStops: number;
    totalAccommodationNights: number;
    tripsByMonth: { month: string; tripCount: number }[];
  }>(sql`
    WITH owned_trips AS (
      SELECT id, start_date FROM trips WHERE user_id = ${res.locals.user.id}
    )
    SELECT
      (SELECT count(*)::int FROM owned_trips) AS "totalTrips",
      (SELECT count(*)::int FROM stops s
        INNER JOIN owned_trips t ON t.id = s.trip_id) AS "totalStops",
      (SELECT coalesce(sum(st.check_out - st.check_in), 0)::int FROM stays st
        INNER JOIN stops s ON s.id = st.stop_id
        INNER JOIN owned_trips t ON t.id = s.trip_id) AS "totalAccommodationNights",
      coalesce((
        SELECT json_agg(m ORDER BY m.month)
        FROM (
          SELECT to_char(start_date, 'YYYY-MM') AS month,
            count(*)::int AS "tripCount"
          FROM owned_trips GROUP BY to_char(start_date, 'YYYY-MM')
        ) m
      ), '[]'::json) AS "tripsByMonth"
  `);
  res.setHeader("Cache-Control", "no-store");
  res.json(result.rows[0]);
});

export default router;
