import { z } from "zod";

export const TRIP_LIMITS = { title: 200, destinationRegion: 200, tripType: 100, notes: 20000 } as const;
export const TRIP_LABELS = {
  title: "Title", startDate: "Start date", endDate: "End date",
  destinationRegion: "Region", tripType: "Trip type", notes: "Notes",
} as const;
export type TripField = keyof typeof TRIP_LABELS;
export type TripFieldErrors = Partial<Record<TripField, string[]>>;

// Shared by both browser and server. Never coerce dates/numbers/objects to text.
export function isTripDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < "0001-01-01") return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

const dateOnly = (label: string) => z.string({
  required_error: label === "End date" ? "Choose an end date." : "Choose a start date.",
  invalid_type_error: `${label} must use YYYY-MM-DD. Choose a calendar date.`,
}).superRefine((value, ctx) => {
  if (!value) ctx.addIssue({ code: "custom", message: label === "End date" ? "Choose an end date." : "Choose a start date." });
  else if (!isTripDate(value)) ctx.addIssue({
    code: "custom", message: `Enter a real ${label.toLowerCase()} in YYYY-MM-DD (year 0001–9999).`,
  });
});

const safeText = (label: string, max: number, trim: boolean) => {
  const text = z.string({
    required_error: `Enter a ${label.toLowerCase()}.`,
    invalid_type_error: `${label} must be text. Remove the invalid value and try again.`,
  });
  return (trim ? text.trim() : text)
    .max(max, `${label} must be ${max.toLocaleString("en-US")} characters or fewer.`)
    .refine((value) => !value.includes("\0"), `${label} contains an unsupported null character. Remove it and try again.`);
};
const optionalText = (label: string, max: number, trim = true) =>
  safeText(label, max, trim).nullable().optional()
    .transform((value) => value?.trim() ? value : null);

export const tripInputSchema = z.object({
  title: safeText("Title", TRIP_LIMITS.title, true)
    .refine((value) => value.length > 0, "Enter a trip title."),
  startDate: dateOnly("Start date"),
  endDate: dateOnly("End date"),
  destinationRegion: optionalText("Region", TRIP_LIMITS.destinationRegion),
  tripType: optionalText("Trip type", TRIP_LIMITS.tripType),
  // Preserve intentional indentation and outer line breaks in nonblank notes.
  notes: optionalText("Notes", TRIP_LIMITS.notes, false),
}, {
  invalid_type_error: "Send trip details as a JSON object.",
  required_error: "Send trip details as a JSON object.",
}).strict("Only editable trip fields can be saved. Reload the trip form and try again.")
  .superRefine((value, ctx) => {
    if (isTripDate(value.startDate) && isTripDate(value.endDate) && value.endDate < value.startDate) {
      ctx.addIssue({ code: "custom", path: ["endDate"], message: "End date must be on or after start date." });
    }
  });

export function tripValidationError(error: z.ZodError) {
  const fields: TripFieldErrors = {};
  const formErrors: string[] = [];
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field === "string" && Object.hasOwn(TRIP_LABELS, field)) {
      const key = field as TripField;
      const messages = fields[key] ?? (fields[key] = []);
      if (!messages.includes(issue.message)) messages.push(issue.message);
    } else if (!formErrors.includes(issue.message)) formErrors.push(issue.message);
  }
  return {
    error: formErrors[0] ?? "Check the highlighted fields and try again.",
    fields, formErrors,
  };
}

export function tripFormErrors(input: unknown): Partial<Record<TripField, string>> {
  const result = tripInputSchema.safeParse(input);
  if (result.success) return {};
  return Object.fromEntries(Object.entries(tripValidationError(result.error).fields)
    .map(([field, messages]) => [field, messages?.[0]]));
}

export const tripIdSchema = z.string().uuid();
