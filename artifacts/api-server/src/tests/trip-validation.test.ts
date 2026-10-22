import { describe, expect, it } from "vitest";
import { isTripDate, tripFormErrors, tripInputSchema, tripValidationError, TRIP_LIMITS } from "@workspace/api-zod";

const valid = {
  title: "Test trip", startDate: "2026-02-01", endDate: "2026-02-02",
  destinationRegion: "", tripType: "", notes: "",
};

describe("shared browser/server trip validation contract", () => {
  it.each(["0001-01-01", "0099-12-31", "1900-02-28", "2000-02-29", "2024-02-29", "9999-12-31"])(
    "accepts real date boundary %s without timezone coercion", (date) => {
      expect(isTripDate(date)).toBe(true);
      const parsed = tripInputSchema.parse({ ...valid, startDate: date, endDate: date });
      expect(parsed.startDate).toBe(date);
      expect(parsed.endDate).toBe(date);
    },
  );
  it.each(["", "0000-01-01", "10000-01-01", "1900-02-29", "2023-02-29", "2026-02-30",
    "2026-04-31", "2026-00-01", "2026-01-00", "2026-13-01", "2026-1-01",
    " 2026-01-01", "2026-01-01T00:00:00Z", "not a date"])(
    "rejects impossible/malformed date %j in both shared entry points", (date) => {
      expect(isTripDate(date)).toBe(false);
      const input = { ...valid, startDate: date };
      const parsed = tripInputSchema.safeParse(input);
      expect(parsed.success).toBe(false);
      if (parsed.success) throw new Error("Invalid date accepted");
      expect(tripFormErrors(input).startDate).toBe(tripValidationError(parsed.error).fields.startDate?.[0]);
      expect(tripFormErrors(input).endDate).toBeUndefined(); // no misleading date-order error
    },
  );

  it("uses identical required/date-order messages and field paths on both sides", () => {
    const empty = tripFormErrors({ title: " \t\n", startDate: "", endDate: "" });
    expect(empty).toEqual({
      title: "Enter a trip title.", startDate: "Choose a start date.", endDate: "Choose an end date.",
    });
    const invalid = { ...valid, endDate: "2026-01-01" };
    const result = tripInputSchema.safeParse(invalid);
    expect(result.success).toBe(false);
    if (result.success) throw new Error("Backwards dates accepted");
    expect(tripFormErrors(invalid)).toEqual({ endDate: "End date must be on or after start date." });
    expect(tripValidationError(result.error).fields.endDate).toEqual([tripFormErrors(invalid).endDate]);
  });

  it.each(Object.entries(TRIP_LIMITS))("accepts exact %s limit and rejects limit plus one", (field, limit) => {
    const boundary = { ...valid, [field]: "x".repeat(limit) };
    expect(tripInputSchema.safeParse(boundary).success).toBe(true);
    const tooLong = { ...valid, [field]: "x".repeat(limit + 1) };
    expect(tripInputSchema.safeParse(tooLong).success).toBe(false);
    expect(tripFormErrors(tooLong)[field as keyof typeof TRIP_LIMITS]).toContain(limit.toLocaleString("en-US"));
  });

  it.each(["destinationRegion", "tripType", "notes"])("normalizes absent, null and whitespace %s to null", (field) => {
    for (const value of [undefined, null, "", " \t\n "]) {
      expect(tripInputSchema.parse({ ...valid, [field]: value })[field as "notes"]).toBeNull();
    }
  });
  it("trims single-line fields but preserves nonblank note whitespace and Unicode", () => {
    const notes = "\n  日本語の思い出 🌲\nSecond line  \n";
    expect(tripInputSchema.parse({
      ...valid, title: "  海への旅  ", destinationRegion: "  日本  ", tripType: "  Family visit  ", notes,
    })).toMatchObject({ title: "海への旅", destinationRegion: "日本", tripType: "Family visit", notes });
    expect(tripInputSchema.safeParse({ ...valid, notes: "🌲".repeat(10000) }).success).toBe(true);
  });
  it.each(["title", "destinationRegion", "tripType", "notes"])("rejects database-unsupported NUL in %s before SQL", (field) => {
    const input = { ...valid, [field]: "text\0text" };
    expect(tripFormErrors(input)[field as keyof typeof TRIP_LIMITS]).toContain("null character");
  });
  it.each([null, undefined, [], "text", 12, true])("rejects non-object body %j with a safe form message", (input) => {
    const result = tripInputSchema.safeParse(input);
    expect(result.success).toBe(false);
    if (result.success) throw new Error("Non-object accepted");
    expect(tripValidationError(result.error)).toEqual({
      error: "Send trip details as a JSON object.", fields: {}, formErrors: ["Send trip details as a JSON object."],
    });
  });
  it.each(["title", "startDate", "endDate", "destinationRegion", "tripType", "notes"])(
    "does not coerce object/array/number/boolean values in %s", (field) => {
      for (const value of [{ privateValue: "do not echo" }, [], 1, false]) {
        const result = tripInputSchema.safeParse({ ...valid, [field]: value });
        expect(result.success).toBe(false);
        if (result.success) throw new Error("Invalid type accepted");
        const formatted = tripValidationError(result.error);
        expect(formatted.fields[field as "title"]?.length).toBeGreaterThan(0);
        expect(JSON.stringify(formatted)).not.toContain("privateValue");
      }
    },
  );
  it("rejects unknown/server-owned properties without reflecting their names/values", () => {
    const result = tripInputSchema.safeParse({ ...valid, userId: "secret-owner-value" });
    expect(result.success).toBe(false);
    if (result.success) throw new Error("Unknown owner accepted");
    const response = tripValidationError(result.error);
    expect(response.formErrors).toEqual(["Only editable trip fields can be saved. Reload the trip form and try again."]);
    expect(JSON.stringify(response)).not.toContain("secret-owner-value");
  });
});
