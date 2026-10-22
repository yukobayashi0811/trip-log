import { describe, expect, it } from "vitest";
import { stopInputSchema, stopOrderSchema, stopValidationError } from "@workspace/api-zod";
const input = { name: "A stop", latitude: 0, longitude: 0 };
describe("shared stop validation used by API and map editor", () => {
  it.each([-90, 0, 90])("accepts latitude %s including zero", (latitude) => {
    expect(stopInputSchema.parse({ ...input, latitude }).latitude).toBe(latitude);
  });
  it.each([-180, 0, 180])("accepts longitude %s including zero", (longitude) => {
    expect(stopInputSchema.parse({ ...input, longitude }).longitude).toBe(longitude);
  });
  it.each([NaN, Infinity, -Infinity, "", "0", null, [], {}, undefined])("does not coerce invalid coordinate %j", (latitude) => {
    const parsed = stopInputSchema.safeParse({ ...input, latitude });
    expect(parsed.success).toBe(false);
    if (parsed.success) throw new Error("Bad coordinate accepted");
    expect(stopValidationError(parsed.error).fields.latitude.length).toBeGreaterThan(0);
  });
  it("rounds fractional coordinates to six decimal places; trims names but not meaningful notes", () => {
    expect(stopInputSchema.parse({ ...input, name: "  Memories  ", latitude: 1.123456789, longitude: -2.123456789,
      notes: "\n  Line one\nLine two \n", stopType: "  Park  " })).toMatchObject({
      name: "Memories", latitude: 1.123457, longitude: -2.123457, stopType: "Park", notes: "\n  Line one\nLine two \n",
    });
  });
  it.each(["0001-01-01", "2000-02-29", "9999-12-31", "", null, undefined])("accepts optional real visit date %j", (visitDate) => {
    expect(stopInputSchema.safeParse({ ...input, visitDate }).success).toBe(true);
  });
  it.each(["2023-02-29", "1900-02-29", "2026-04-31", "2026-1-01", 0, false])("rejects invalid visit date %j", (visitDate) => {
    expect(stopInputSchema.safeParse({ ...input, visitDate }).success).toBe(false);
  });
  it("normalizes optional blanks to null, not server-owned fields", () => {
    expect(stopInputSchema.parse({ ...input, notes: " \n ", stopType: "", visitDate: "" })).toMatchObject({
      notes: null, stopType: null, visitDate: null, transportFromPrevious: null,
    });
    const parsed = stopInputSchema.safeParse({ ...input, tripId: "do-not-echo" });
    expect(parsed.success).toBe(false);
    if (parsed.success) throw new Error("Unknown field accepted");
    expect(JSON.stringify(stopValidationError(parsed.error))).not.toContain("do-not-echo");
  });
  it.each([-1, 1.5, 2147483648, "1", null])("rejects invalid sort order %j", (sortOrder) => {
    expect(stopInputSchema.safeParse({ ...input, sortOrder }).success).toBe(false);
  });
  it("requires unique UUIDs in an exact order body and rejects extra fields", () => {
    const id = "00000000-0000-4000-8000-000000000001";
    expect(stopOrderSchema.safeParse({ stopIds: [] }).success).toBe(true);
    expect(stopOrderSchema.safeParse({ stopIds: [id, id] }).success).toBe(false);
    expect(stopOrderSchema.safeParse({ stopIds: ["not-a-uuid"] }).success).toBe(false);
    expect(stopOrderSchema.safeParse({ stopIds: [id], tripId: id }).success).toBe(false);
  });
});
