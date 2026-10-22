import type { Stop, StopInput } from '@workspace/api-client-react';
import { stopInputSchema, stopValidationError, STOP_LABELS, STOP_LIMITS } from '@workspace/api-zod';
import { errorStatus } from '@/lib/trips';

export { STOP_LIMITS };

export type TransportValue = '' | 'Driving' | 'Flying' | 'Other';
export type StopFormValues = {
  name: string; latitude: string; longitude: string; visitDate: string;
  stopType: string; transportFromPrevious: TransportValue; notes: string;
};
export type StopField = keyof StopFormValues;
export type StopFieldErrors = Partial<Record<StopField, string>>;

export const STOP_FIELD_ORDER: StopField[] = ['name', 'latitude', 'longitude', 'visitDate', 'stopType', 'transportFromPrevious', 'notes'];

export const emptyStopValues: StopFormValues = { name: '', latitude: '', longitude: '', visitDate: '', stopType: '', transportFromPrevious: '', notes: '' };

export function stopToValues(s: Stop): StopFormValues {
  return {
    name: s.name, latitude: String(s.latitude), longitude: String(s.longitude), visitDate: s.visitDate ?? '',
    stopType: s.stopType ?? '', transportFromPrevious: s.transportFromPrevious ?? '', notes: s.notes ?? '',
  };
}

export function sameValues(a: StopFormValues, b: StopFormValues) {
  return STOP_FIELD_ORDER.every((k) => a[k] === b[k]);
}

export function fmtCoord(n: number) {
  return (Math.round(n * 1e6) / 1e6).toString();
}

function toNumber(s: string): number | undefined {
  const t = s.trim();
  if (t === '') return undefined;
  return Number(t);
}

/** Validate with shared schema. Blank coordinates become undefined (never 0). */
export function buildStopInput(v: StopFormValues): { ok: true; data: StopInput } | { ok: false; fields: StopFieldErrors; message: string } {
  const raw = {
    name: v.name,
    latitude: toNumber(v.latitude),
    longitude: toNumber(v.longitude),
    visitDate: v.visitDate === '' ? null : v.visitDate,
    stopType: v.stopType,
    transportFromPrevious: v.transportFromPrevious === '' ? null : v.transportFromPrevious,
    notes: v.notes,
  };
  const r = stopInputSchema.safeParse(raw);
  if (r.success) {
    const d = r.data;
    return { ok: true, data: { name: d.name, latitude: d.latitude, longitude: d.longitude, visitDate: d.visitDate, stopType: d.stopType, transportFromPrevious: d.transportFromPrevious, notes: d.notes } };
  }
  const e = stopValidationError(r.error);
  const fields: StopFieldErrors = {};
  for (const [k, msgs] of Object.entries(e.fields)) {
    if ((STOP_FIELD_ORDER as string[]).includes(k) && msgs[0]) fields[k as StopField] = msgs[0];
  }
  return { ok: false, fields, message: e.formErrors[0] ?? 'Check the highlighted stop fields and try again.' };
}

export function stopApiError(err: unknown): { message: string; fields: StopFieldErrors; conflict: boolean; notFound: boolean } {
  const status = errorStatus(err);
  const data = (err as { data?: { error?: unknown; fields?: Record<string, unknown> } | null } | null)?.data;
  const fields: StopFieldErrors = {};
  if (data?.fields && typeof data.fields === 'object') {
    for (const [k, val] of Object.entries(data.fields)) {
      if (Object.hasOwn(STOP_LABELS, k) && (STOP_FIELD_ORDER as string[]).includes(k) && Array.isArray(val)) {
        const msg = val.find((x): x is string => typeof x === 'string');
        if (msg) fields[k as StopField] = msg;
      }
    }
  }
  const serverMsg = typeof data?.error === 'string' ? data.error : undefined;
  let message: string;
  if (status === 409) message = 'The itinerary changed somewhere else, so it was reloaded. Check the order and try again.';
  else if (status === 400) message = serverMsg || 'Some stop details need another look.';
  else if (status === 401) message = 'Your session could not be verified. Log in again and retry.';
  else if (status === 404) message = 'That trip or stop is no longer in your journal. The itinerary was reloaded.';
  else if (status === 413) message = 'This stop is too large. Shorten the notes and try again.';
  else if (status && status >= 500) message = 'The journal is having trouble right now. Your entry is still here; try again in a moment.';
  else message = "We couldn't reach the journal. Check your connection and try again.";
  return { message, fields, conflict: status === 409, notFound: status === 404 };
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
