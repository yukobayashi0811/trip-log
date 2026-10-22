import type { Stay, StayInput } from "@workspace/api-client-react";
import {
  stayInputSchema, stayValidationError, STAY_LABELS,
  type StayField, type StayFieldErrors,
} from "@workspace/api-zod";
import { errorStatus } from "@/lib/trips";

export type StayFormValues = {
  accommodationType: string;
  checkIn: string;
  checkOut: string;
  rating: string;
  notes: string;
};

export type StayFormFieldErrors = Partial<Record<StayField, string>>;
export type { StayField };

export const emptyStayValues: StayFormValues = {
  accommodationType: "",
  checkIn: "",
  checkOut: "",
  rating: "",
  notes: "",
};

export function stayToValues(stay: Stay): StayFormValues {
  return {
    accommodationType: stay.accommodationType,
    checkIn: stay.checkIn,
    checkOut: stay.checkOut,
    rating: stay.rating === null ? "" : String(stay.rating),
    notes: stay.notes ?? "",
  };
}

export function buildStayInput(values: StayFormValues):
  | { ok: true; data: StayInput }
  | { ok: false; fields: StayFormFieldErrors; message: string } {
  const raw = {
    accommodationType: values.accommodationType,
    checkIn: values.checkIn,
    checkOut: values.checkOut,
    rating: values.rating.trim() === "" ? null : Number(values.rating),
    notes: values.notes,
  };
  const parsed = stayInputSchema.safeParse(raw);
  if (parsed.success) {
    return {
      ok: true,
      data: {
        accommodationType: parsed.data.accommodationType,
        checkIn: parsed.data.checkIn,
        checkOut: parsed.data.checkOut,
        rating: parsed.data.rating ?? null,
        notes: parsed.data.notes ?? null,
      },
    };
  }

  const validation = stayValidationError(parsed.error);
  const fields: StayFormFieldErrors = {};
  for (const [key, messages] of Object.entries(validation.fields)) {
    if (Object.hasOwn(STAY_LABELS, key) && messages?.[0]) {
      fields[key as StayField] = messages[0];
    }
  }
  return {
    ok: false,
    fields,
    message: validation.formErrors[0] ?? "Check the highlighted accommodation fields and try again.",
  };
}

export function stayApiError(error: unknown): {
  message: string;
  fields: StayFormFieldErrors;
  conflict: boolean;
  notFound: boolean;
} {
  const status = errorStatus(error);
  const data = (error as { data?: { error?: unknown; fields?: Record<string, unknown> } | null } | null)?.data;
  const fields: StayFormFieldErrors = {};
  if (data?.fields && typeof data.fields === "object") {
    for (const [key, value] of Object.entries(data.fields)) {
      if (Object.hasOwn(STAY_LABELS, key) && Array.isArray(value)) {
        const firstMessage = value.find((item): item is string => typeof item === "string");
        if (firstMessage) fields[key as StayField] = firstMessage;
      }
    }
  }

  const serverMessage = typeof data?.error === "string" ? data.error : undefined;
  let message: string;
  if (status === 409) message = serverMessage ?? "This stop already has an accommodation. Reload and edit the existing stay.";
  else if (status === 400) message = serverMessage ?? "Some accommodation details need another look.";
  else if (status === 401) message = "Your session could not be verified. Log in again and retry.";
  else if (status === 404) message = "This trip, stop, or accommodation is no longer available. The itinerary was reloaded.";
  else if (status === 413) message = "These accommodation details are too large. Shorten the notes and try again.";
  else if (status && status >= 500) message = "The journal is having trouble right now. Your entry is still here; try again in a moment.";
  else message = "We couldn't reach the journal. Check your connection and try again.";

  return { message, fields, conflict: status === 409, notFound: status === 404 };
}
