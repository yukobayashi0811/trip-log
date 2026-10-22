import { useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'wouter';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { validateTrip, type FieldErrors, type TripFormValues } from '@/lib/trips';

type Props = {
  initial: TripFormValues;
  submitLabel: string;
  pendingLabel: string;
  pending: boolean;
  serverError: string | null;
  serverFields: FieldErrors;
  cancelHref: string;
  onSubmit: (values: TripFormValues) => void;
};

const inputCls = 'w-full rounded-xl border border-input bg-[hsl(40_40%_99%)] px-3.5 py-2.5 text-[15px] outline-none transition-shadow placeholder:text-muted-foreground/70 focus:border-ring focus:ring-[3px] focus:ring-ring/15 aria-[invalid=true]:border-destructive disabled:opacity-70';

function Field({ id, label, hint, error, children, required }: { id: string; label: string; hint?: string; error?: string; children: ReactNode; required?: boolean }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="flex items-baseline gap-2 text-sm font-medium">
        {label}
        {required ? <span className="text-xs font-normal text-muted-foreground">required</span> : <span className="text-xs font-normal text-muted-foreground">optional</span>}
      </label>
      {children}
      {error ? <p id={`${id}-error`} className="text-sm text-destructive" data-testid={`error-${id}`}>{error}</p> : hint ? <p id={`${id}-hint`} className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function TripForm({ initial, submitLabel, pendingLabel, pending, serverError, serverFields, cancelHref, onSubmit }: Props) {
  const [values, setValues] = useState<TripFormValues>(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const shown: FieldErrors = { ...serverFields, ...errors };

  const set = (k: keyof TripFormValues) => (e: { target: { value: string } }) => {
    setValues((v) => ({ ...v, [k]: e.target.value }));
    if (errors[k]) setErrors((er) => ({ ...er, [k]: undefined }));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (pending) return;
    const v = validateTrip(values);
    setErrors(v);
    if (Object.values(v).some(Boolean)) {
      const first = Object.keys(v).find((k) => v[k as keyof TripFormValues]);
      if (first) document.getElementById(`trip-${first}`)?.focus();
      return;
    }
    onSubmit(values);
  };

  const a11y = (k: keyof TripFormValues) => ({
    id: `trip-${k}`,
    'aria-invalid': shown[k] ? true : undefined,
    'aria-describedby': shown[k] ? `trip-${k}-error` : undefined,
    disabled: pending,
  });

  return (
    <form onSubmit={submit} noValidate={false} className="space-y-6" aria-busy={pending} data-testid="form-trip">
      {serverError && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm" data-testid="text-form-error">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <p>{serverError}</p>
        </div>
      )}
      <Field id="trip-title" label="Title" required error={shown.title}>
        <input {...a11y('title')} required maxLength={200} value={values.title} onChange={set('title')} placeholder="Blue Ridge in October" className={`${inputCls} font-display text-lg`} data-testid="input-title" />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="trip-startDate" label="Start date" required error={shown.startDate}>
          <input {...a11y('startDate')} type="date" required value={values.startDate} onChange={set('startDate')} className={inputCls} data-testid="input-start-date" />
        </Field>
        <Field id="trip-endDate" label="End date" required error={shown.endDate}>
          <input {...a11y('endDate')} type="date" required min={values.startDate || undefined} value={values.endDate} onChange={set('endDate')} className={inputCls} data-testid="input-end-date" />
        </Field>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="trip-destinationRegion" label="Region" hint="A state, park, coastline, or country." error={shown.destinationRegion}>
          <input {...a11y('destinationRegion')} maxLength={200} value={values.destinationRegion} onChange={set('destinationRegion')} placeholder="Western North Carolina" className={inputCls} data-testid="input-region" />
        </Field>
        <Field id="trip-tripType" label="Trip type" hint="Road trip, camping, family visit…" error={shown.tripType}>
          <input {...a11y('tripType')} maxLength={100} value={values.tripType} onChange={set('tripType')} placeholder="Road trip" className={inputCls} data-testid="input-trip-type" />
        </Field>
      </div>
      <Field id="trip-notes" label="Notes" hint="Line breaks are kept exactly as you write them." error={shown.notes}>
        <textarea {...a11y('notes')} maxLength={20000} rows={8} value={values.notes} onChange={set('notes')} placeholder="What you want to remember." className={`${inputCls} min-h-[180px] resize-y leading-relaxed`} data-testid="input-notes" />
      </Field>
      <div className="flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:justify-end">
        <Link href={cancelHref} className="inline-flex justify-center rounded-full border border-border px-5 py-2.5 text-sm font-medium hover:bg-card" data-testid="link-cancel">Cancel</Link>
        <button type="submit" disabled={pending} className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-transform hover:bg-primary/90 active:scale-[0.98] disabled:opacity-70" data-testid="button-submit">
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          {pending ? pendingLabel : submitLabel}
        </button>
      </div>
    </form>
  );
}
