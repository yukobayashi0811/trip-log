import { z } from "zod";

// Keep date-only values as ISO strings: no browser/server timezone shifts.
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return value >= "0001-01-01" && !Number.isNaN(date.getTime())
      && date.toISOString().slice(0, 10) === value;
  }, "Enter a real calendar date.");

const optionalText = (max: number) =>
  z.string().trim().max(max).nullable().optional().transform((value) => value || null);

export const tripInputSchema = z.object({
  title: z.string().trim().min(1, "Enter a trip title.").max(200),
  startDate: dateOnly,
  endDate: dateOnly,
  destinationRegion: optionalText(200),
  tripType: optionalText(100),
  notes: optionalText(20000),
}).strict().refine((value) => value.endDate >= value.startDate, {
  path: ["endDate"], message: "End date must be on or after start date.",
});

export const tripIdSchema = z.string().uuid();
