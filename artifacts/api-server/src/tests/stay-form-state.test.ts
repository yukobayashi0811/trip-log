import { describe, expect, it } from "vitest";
import {
  emptyStayValues,
  hasUnsavedStayChanges,
  stayFormValuesFromStay,
} from "@workspace/api-zod";

describe("accommodation form draft isolation", () => {
  const stopA = stayFormValuesFromStay({
    accommodationType: "Hotel",
    checkIn: "2026-10-10",
    checkOut: "2026-10-12",
    rating: 4,
    notes: "Stop A draft",
  });

  it("tracks edits against the current stop baseline and clears when restored", () => {
    expect(hasUnsavedStayChanges(stopA, stopA)).toBe(false);
    expect(hasUnsavedStayChanges({ ...stopA, notes: "Unsaved edit" }, stopA)).toBe(true);
    expect(hasUnsavedStayChanges({ ...stopA, notes: "Stop A draft" }, stopA)).toBe(false);
  });

  it("does not treat Stop A values as a clean draft for a different stop", () => {
    const stopB = { ...emptyStayValues };
    expect(stopB).toEqual(emptyStayValues);
    expect(stopB).not.toBe(emptyStayValues);
    expect(hasUnsavedStayChanges(stopA, stopB)).toBe(true);
    expect(hasUnsavedStayChanges(stopB, stopB)).toBe(false);
  });
});
