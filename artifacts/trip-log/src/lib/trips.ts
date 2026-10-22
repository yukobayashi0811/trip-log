import type { Trip, TripInput } from '@workspace/api-client-react';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function parseYmd(s: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!match) return null;
  const y = Number(match[1]), m = Number(match[2]), d = Number(match[3]);
  const dt = new Date(`${s}T00:00:00.000Z`);
  if (y < 1 || dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return { y, m, d };
}

export function formatDate(s: string, long = false): string {
  const p = parseYmd(s);
  if (!p) return s;
  return long ? `${MONTHS_LONG[p.m - 1]} ${p.d}, ${p.y}` : `${MONTHS[p.m - 1]} ${p.d}, ${p.y}`;
}

export function formatRange(start: string, end: string): string {
  if (start === end) return formatDate(start);
  const a = parseYmd(start), b = parseYmd(end);
  if (a && b && a.y === b.y) {
    if (a.m === b.m) return `${MONTHS[a.m - 1]} ${a.d} – ${b.d}, ${a.y}`;
    return `${MONTHS[a.m - 1]} ${a.d} – ${MONTHS[b.m - 1]} ${b.d}, ${a.y}`;
  }
  return `${formatDate(start)} – ${formatDate(end)}`;
}

export function tripDays(start: string, end: string): number | null {
  const a = parseYmd(start), b = parseYmd(end);
  if (!a || !b) return null;
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000) + 1;
}

export function startParts(s: string) {
  const p = parseYmd(s);
  return p ? { month: MONTHS[p.m - 1], day: String(p.d), year: String(p.y) } : { month: '', day: s, year: '' };
}

export type TripFormValues = { title: string; startDate: string; endDate: string; destinationRegion: string; tripType: string; notes: string };

export const emptyTripValues: TripFormValues = { title: '', startDate: '', endDate: '', destinationRegion: '', tripType: '', notes: '' };

export function tripToValues(t: Trip): TripFormValues {
  return { title: t.title, startDate: t.startDate, endDate: t.endDate, destinationRegion: t.destinationRegion ?? '', tripType: t.tripType ?? '', notes: t.notes ?? '' };
}

const opt = (v: string) => (v.trim() ? v.trim() : null);

export function valuesToInput(v: TripFormValues): TripInput {
  return { title: v.title.trim(), startDate: v.startDate, endDate: v.endDate, destinationRegion: opt(v.destinationRegion), tripType: opt(v.tripType), notes: v.notes.trim() ? v.notes : null };
}

export type FieldErrors = Partial<Record<keyof TripFormValues, string>>;

export function validateTrip(v: TripFormValues): FieldErrors {
  const e: FieldErrors = {};
  if (!v.title.trim()) e.title = 'Give this trip a title.';
  else if (v.title.trim().length > 200) e.title = 'Keep the title to 200 characters or fewer.';
  if (!v.startDate) e.startDate = 'Choose a start date.';
  else if (!parseYmd(v.startDate)) e.startDate = 'Enter a real calendar date.';
  if (!v.endDate) e.endDate = 'Choose an end date.';
  else if (!parseYmd(v.endDate)) e.endDate = 'Enter a real calendar date.';
  if (!e.startDate && !e.endDate && v.endDate < v.startDate) e.endDate = 'The end date can\'t be before the start date.';
  if (v.destinationRegion.trim().length > 200) e.destinationRegion = 'Keep the region to 200 characters or fewer.';
  if (v.tripType.trim().length > 100) e.tripType = 'Keep the trip type to 100 characters or fewer.';
  if (v.notes.length > 20000) e.notes = 'Notes can be up to 20,000 characters.';
  return e;
}

export function errorStatus(err: unknown): number | undefined {
  return (err as { status?: number } | null)?.status;
}

export function apiErrorInfo(err: unknown): { message: string; fields: FieldErrors } {
  const status = errorStatus(err);
  const data = (err as { data?: { error?: string; fields?: Record<string, unknown> } | null } | null)?.data;
  const fields: FieldErrors = {};
  if (data?.fields && typeof data.fields === 'object') {
    for (const [k, val] of Object.entries(data.fields)) {
      const msg = Array.isArray(val) ? val.join(' ') : String(val);
      (fields as Record<string, string>)[k] = msg;
    }
  }
  let message: string;
  if (status === 400) message = data?.error || 'Some details need another look.';
  else if (status === 401) message = 'Your session could not be verified. Log in again and retry.';
  else if (status === 404) message = 'This trip no longer exists, or it is not in your journal.';
  else if (status && status >= 500) message = 'The journal is having trouble saving right now. Your entry is still here; try again in a moment.';
  else message = 'We couldn\'t reach the journal. Check your connection and try again.';
  return { message, fields };
}
