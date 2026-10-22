import type { ReactNode } from 'react';
import { Crosshair, Loader2, X } from 'lucide-react';
import { STOP_LIMITS, type StopField, type StopFieldErrors, type StopFormValues, type TransportValue } from '@/lib/stops';

const inputCls = 'w-full rounded-xl border border-input bg-card px-3 py-2 text-sm outline-none transition-shadow focus:border-ring focus:ring-[3px] focus:ring-ring/15 aria-[invalid=true]:border-destructive';

function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</label>
      <div className="mt-1.5">{children}</div>
      {error ? <p id={`${id}-error`} className="mt-1 text-xs text-destructive" data-testid={`error-${id}`}>{error}</p> : hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function StopEditor({
  mode, position, values, errors, formError, saving, dirty, mapPicks, onMapPicksChange, onChange, onSubmit, onCancel,
}: {
  mode: 'new' | 'edit'; position: number; values: StopFormValues; errors: StopFieldErrors; formError: string | null;
  saving: boolean; dirty: boolean; mapPicks: boolean; onMapPicksChange: (v: boolean) => void;
  onChange: (field: StopField, value: string) => void; onSubmit: () => void; onCancel: () => void;
}) {
  const a = (f: StopField) => ({ 'aria-invalid': !!errors[f], 'aria-describedby': errors[f] ? `stop-${f}-error` : undefined });
  return (
    <form noValidate onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="rise space-y-4 rounded-2xl border border-card-border bg-card p-4 md:p-5" data-testid="form-stop">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{mode === 'new' ? 'New stop' : `Editing stop ${position}`}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{dirty ? 'Unsaved changes' : 'No changes yet'}</p>
        </div>
        <button type="button" onClick={onCancel} disabled={saving} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-50" aria-label="Close editor" data-testid="button-close-editor"><X className="h-4 w-4" /></button>
      </div>
      {formError && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive" data-testid="text-stop-form-error">{formError}</p>}
      <fieldset disabled={saving} className="space-y-4">
        <Field id="stop-name" label="Stop name" error={errors.name}>
          <input id="stop-name" className={inputCls} value={values.name} maxLength={STOP_LIMITS.name + 50} onChange={(e) => onChange('name', e.target.value)} placeholder="Badwater Basin" autoComplete="off" {...a('name')} data-testid="input-stop-name" />
        </Field>
        <div className="rounded-xl bg-accent/50 p-3">
          <label className="flex cursor-pointer items-start gap-2.5 text-sm">
            <input type="checkbox" checked={mapPicks} onChange={(e) => onMapPicksChange(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[hsl(var(--primary))]" data-testid="checkbox-map-picks" />
            <span><span className="inline-flex items-center gap-1.5 font-medium"><Crosshair className="h-3.5 w-3.5" /> Map clicks set this location</span>
              <span className="block text-xs text-muted-foreground">{mapPicks ? 'Click the map to drop the pin here. Clicks fill in the coordinates below.' : 'Map clicks are ignored while this is off. Type coordinates instead.'}</span></span>
          </label>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Field id="stop-latitude" label="Latitude" error={errors.latitude}>
              <input id="stop-latitude" className={`${inputCls} font-mono`} inputMode="decimal" value={values.latitude} onChange={(e) => onChange('latitude', e.target.value)} placeholder="36.2302" {...a('latitude')} data-testid="input-stop-latitude" />
            </Field>
            <Field id="stop-longitude" label="Longitude" error={errors.longitude}>
              <input id="stop-longitude" className={`${inputCls} font-mono`} inputMode="decimal" value={values.longitude} onChange={(e) => onChange('longitude', e.target.value)} placeholder="-116.7670" {...a('longitude')} data-testid="input-stop-longitude" />
            </Field>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="stop-visitDate" label="Visit date" error={errors.visitDate} hint="Optional">
            <input id="stop-visitDate" type="date" className={inputCls} value={values.visitDate} onChange={(e) => onChange('visitDate', e.target.value)} {...a('visitDate')} data-testid="input-stop-visit-date" />
          </Field>
          <Field id="stop-transportFromPrevious" label="Arrived by" error={errors.transportFromPrevious} hint="From the previous stop">
            <select id="stop-transportFromPrevious" className={inputCls} value={values.transportFromPrevious} onChange={(e) => onChange('transportFromPrevious', e.target.value as TransportValue)} {...a('transportFromPrevious')} data-testid="select-stop-transport">
              <option value="">Not recorded</option>
              <option value="Driving">Driving</option>
              <option value="Flying">Flying</option>
              <option value="Other">Other</option>
            </select>
          </Field>
        </div>
        <Field id="stop-stopType" label="Stop type" error={errors.stopType} hint="Free text, like campsite or trailhead">
          <input id="stop-stopType" className={inputCls} value={values.stopType} onChange={(e) => onChange('stopType', e.target.value)} placeholder="Campsite" {...a('stopType')} data-testid="input-stop-type" />
        </Field>
        <Field id="stop-notes" label="Notes" error={errors.notes} hint={`${values.notes.length.toLocaleString()} / ${STOP_LIMITS.notes.toLocaleString()}`}>
          <textarea id="stop-notes" rows={4} className={`${inputCls} resize-y`} value={values.notes} onChange={(e) => onChange('notes', e.target.value)} placeholder="What made this place worth stopping for?" {...a('notes')} data-testid="input-stop-notes" />
        </Field>
      </fieldset>
      <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} disabled={saving} className="rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50" data-testid="button-cancel-stop">Cancel</button>
        <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60" data-testid="button-save-stop">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}{saving ? 'Saving…' : mode === 'new' ? 'Add stop' : 'Save stop'}
        </button>
      </div>
    </form>
  );
}
