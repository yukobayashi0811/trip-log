import { z } from "zod";

export const STAY_TYPES = ["Hotel", "Campground", "Vacation Rental", "Other"] as const;
export const STAY_LABELS = {
  accommodationType: "Accommodation type",
  checkIn: "Check-in date",
  checkOut: "Check-out date",
  rating: "Rating",
  notes: "Notes",
} as const;

export type StayField = keyof typeof STAY_LABELS;
export type StayFieldErrors = Partial<Record<StayField, string[]>>;

// Calendar-only values are kept as ISO date strings, with no past/future or
// trip-range restrictions. Do not convert these values through a time zone.
export function isStayCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const monthDays = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= monthDays[month - 1];
}

const dateOnly = (label: "check-in" | "check-out") =>
  z.string({
    required_error: `Choose a ${label} date.`,
    invalid_type_error: `${label === "check-in" ? "Check-in" : "Check-out"} must be a calendar date.`,
  }).superRefine((value, ctx) => {
    if (!value) ctx.addIssue({ code: "custom", message: `Choose a ${label} date.` });
    else if (!isStayCalendarDate(value)) {
      ctx.addIssue({ code: "custom", message: `Enter a real ${label} date in YYYY-MM-DD format.` });
    }
  });

export const stayInputSchema = z.object({
  accommodationType: z.enum(STAY_TYPES, {
    errorMap: () => ({ message: "Choose Hotel, Campground, Vacation Rental, or Other." }),
  }),
  checkIn: dateOnly("check-in"),
  checkOut: dateOnly("check-out"),
  rating: z.number({
    invalid_type_error: "Rating must be a whole number from 1 to 5.",
  }).int("Rating must be a whole number from 1 to 5.")
    .min(1, "Rating must be from 1 to 5.").max(5, "Rating must be from 1 to 5.")
    .nullable().optional(),
  notes: z.string({ invalid_type_error: "Notes must be text." })
    .nullable().optional()
    .transform((value) => value?.trim() ? value : null),
}, {
  invalid_type_error: "Send accommodation details as a JSON object.",
  required_error: "Send accommodation details as a JSON object.",
}).strict("Only accommodation details can be saved.")
  .superRefine((value, ctx) => {
    if (isStayCalendarDate(value.checkIn) && isStayCalendarDate(value.checkOut) && value.checkOut <= value.checkIn) {
      ctx.addIssue({
        code: "custom",
        path: ["checkOut"],
        message: "Check-out must be later than check-in.",
      });
    }
  });

export const stayResponseSchema = z.object({
  id: z.string().uuid(),
  stopId: z.string().uuid(),
  accommodationType: z.enum(STAY_TYPES),
  checkIn: dateOnly("check-in"),
  checkOut: dateOnly("check-out"),
  rating: z.number().int().min(1).max(5).nullable(),
  notes: z.string().nullable(),
}).strict().superRefine((value, ctx) => {
  if (isStayCalendarDate(value.checkIn) && isStayCalendarDate(value.checkOut) && value.checkOut <= value.checkIn) {
    ctx.addIssue({
      code: "custom",
      path: ["checkOut"],
      message: "Check-out must be later than check-in.",
    });
  }
});

export function stayValidationError(error: z.ZodError) {
  const fields: StayFieldErrors = {};
  const formErrors: string[] = [];
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field === "string" && Object.hasOwn(STAY_LABELS, field)) {
      const key = field as StayField;
      const messages = fields[key] ?? (fields[key] = []);
      if (!messages.includes(issue.message)) messages.push(issue.message);
    } else if (!formErrors.includes(issue.message)) formErrors.push(issue.message);
  }
  return { error: formErrors[0] ?? "Check the highlighted accommodation fields and try again.", fields, formErrors };
}

export function stayFormErrors(input: unknown): Partial<Record<StayField, string>> {
  const result = stayInputSchema.safeParse(input);
  if (result.success) return {};
  return Object.fromEntries(Object.entries(stayValidationError(result.error).fields)
    .map(([field, messages]) => [field, messages?.[0]]));
}
