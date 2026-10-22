import { z } from "zod";
import { isTripDate } from "./trip-input";

export const STOP_LIMITS = { name: 200, stopType: 100, notes: 20000 } as const;
export const STOP_TRANSPORTS = ["Driving", "Flying", "Other"] as const;
export const STOP_LABELS = {
  name: "Stop name", latitude: "Latitude", longitude: "Longitude",
  visitDate: "Visit date", sortOrder: "Position", stopType: "Stop type",
  transportFromPrevious: "Transport from previous stop", notes: "Notes",
} as const;
const text = (label: string, max: number, trim = true) => {
  const value = z.string({ required_error: `Enter ${label.toLowerCase()}.`, invalid_type_error: `${label} must be text.` });
  return (trim ? value.trim() : value)
    .max(max, `${label} must be ${max.toLocaleString("en-US")} characters or fewer.`)
    .refine((v) => !v.includes("\0"), `${label} contains an unsupported null character.`);
};
const optionalText = (label: string, max: number, trim = true) =>
  text(label, max, trim).nullable().optional().transform((v) => v?.trim() ? v : null);
const coordinate = (label: string, min: number, max: number) => z.number({
  required_error: `Choose ${label.toLowerCase()} on the map or enter a number.`,
  invalid_type_error: `${label} must be a number.`,
}).finite(`${label} must be finite.`).min(min, `${label} must be between ${min} and ${max}.`)
  .max(max, `${label} must be between ${min} and ${max}.`)
  .transform((v) => Math.round(v * 1e6) / 1e6);

export const stopInputSchema = z.object({
  name: text("Stop name", STOP_LIMITS.name).refine((v) => v.length > 0, "Enter a stop name."),
  latitude: coordinate("Latitude", -90, 90),
  longitude: coordinate("Longitude", -180, 180),
  sortOrder: z.number({ invalid_type_error: "Position must be a whole number." })
    .int("Position must be a whole number.").min(0, "Position cannot be negative.")
    .max(2147483647, "Position is too large.").optional(),
  visitDate: z.string({ invalid_type_error: "Choose a real visit date." })
    .refine((v) => v === "" || isTripDate(v), "Enter a real visit date in YYYY-MM-DD (year 0001–9999).")
    .nullable().optional().transform((v) => v || null),
  stopType: optionalText("Stop type", STOP_LIMITS.stopType),
  transportFromPrevious: z.enum(STOP_TRANSPORTS, {
    errorMap: () => ({ message: "Choose Driving, Flying, Other, or no transport." }),
  }).nullable().optional().transform((v) => v ?? null),
  notes: optionalText("Notes", STOP_LIMITS.notes, false),
}, { invalid_type_error: "Send stop details as a JSON object.", required_error: "Send stop details as a JSON object." })
  .strict("Only editable stop fields can be saved.");

export const stopOrderSchema = z.object({
  stopIds: z.array(z.string().uuid("Each stop ID must be a UUID."), {
    required_error: "Send the complete ordered list of stop IDs.",
  }).refine((ids) => new Set(ids).size === ids.length, "Each stop must appear exactly once."),
}).strict("Send only the ordered stop IDs.");

export function stopValidationError(error: z.ZodError) {
  const fields: Record<string, string[]> = {};
  const formErrors: string[] = [];
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field === "string" && (Object.hasOwn(STOP_LABELS, field) || field === "stopIds")) {
      (fields[field] ??= []).push(issue.message);
    } else formErrors.push(issue.message);
  }
  return { error: formErrors[0] ?? "Check the highlighted stop fields and try again.", fields, formErrors };
}
