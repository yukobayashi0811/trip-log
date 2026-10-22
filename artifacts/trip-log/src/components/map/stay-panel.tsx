import { useRef, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BedDouble, Loader2, Pencil, Plus, Star, Trash2 } from "lucide-react";
import {
  getGetStopQueryKey, getListStopsQueryKey,
  useCreateStay, useDeleteStay, useUpdateStay, type Stop,
} from "@workspace/api-client-react";
import { STAY_TYPES, type StayField } from "@workspace/api-zod";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { formatDate } from "@/lib/trips";
import {
  buildStayInput, emptyStayValues, hasUnsavedStayChanges, stayApiError, stayToValues,
  type StayFormFieldErrors, type StayFormValues,
} from "@/lib/stays";

export function StayPanel({ stop, onDirtyChange }: {
  stop: Stop;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const qc = useQueryClient();
  const create = useCreateStay();
  const update = useUpdateStay();
  const remove = useDeleteStay();
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<StayFormValues>(emptyStayValues);
  const [fields, setFields] = useState<StayFormFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const initialValues = useRef<StayFormValues>({ ...emptyStayValues });
  const saving = create.isPending || update.isPending;

  const refreshStop = () => {
    void qc.invalidateQueries({ queryKey: getListStopsQueryKey(stop.tripId) });
    void qc.invalidateQueries({ queryKey: getGetStopQueryKey(stop.tripId, stop.id) });
  };

  const beginEdit = () => {
    const next = stop.stay ? stayToValues(stop.stay) : { ...emptyStayValues };
    initialValues.current = next;
    setValues(next);
    setFields({});
    setFormError(null);
    onDirtyChange(false);
    setEditing(true);
  };

  const change = (field: keyof StayFormValues, value: string) => {
    const next = { ...values, [field]: value };
    setValues(next);
    onDirtyChange(hasUnsavedStayChanges(next, initialValues.current));
    setFields((current) => ({ ...current, [field as StayField]: undefined }));
    setFormError(null);
  };

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    const result = buildStayInput(values);
    if (!result.ok) {
      setFields(result.fields);
      setFormError(Object.values(result.fields).some(Boolean)
        ? "Check the highlighted fields."
        : result.message);
      return;
    }

    setFields({});
    setFormError(null);
    const variables = { tripId: stop.tripId, stopId: stop.id, data: result.data };
    const options = {
      onSuccess: () => {
        refreshStop();
        onDirtyChange(false);
        setEditing(false);
      },
      onError: (error: unknown) => {
        const info = stayApiError(error);
        setFields(info.fields);
        setFormError(info.message);
        if (info.conflict || info.notFound) refreshStop();
      },
    };
    if (stop.stay) update.mutate(variables, options);
    else create.mutate(variables, options);
  };

  const deleteStay = () => {
    if (remove.isPending) return;
    setDeleteError(null);
    remove.mutate({ tripId: stop.tripId, stopId: stop.id }, {
      onSuccess: () => {
        setDeleteOpen(false);
        refreshStop();
      },
      onError: (error) => {
        const info = stayApiError(error);
        setDeleteError(info.message);
        if (info.conflict || info.notFound) refreshStop();
      },
    });
  };

  return (
    <section className="mt-4 rounded-2xl border border-card-border bg-background/70 p-4" aria-label="Accommodation" data-testid={`panel-stay-${stop.id}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            <BedDouble className="h-4 w-4 text-primary" /> Accommodation
          </p>
          {stop.stay ? (
            <>
              <h4 className="mt-2 font-display text-lg" data-testid={`text-stay-type-${stop.id}`}>{stop.stay.accommodationType}</h4>
              <p className="mt-1 text-sm text-muted-foreground" data-testid={`text-stay-dates-${stop.id}`}>
                {formatDate(stop.stay.checkIn, true)} – {formatDate(stop.stay.checkOut, true)}
              </p>
              {stop.stay.rating !== null && (
                <p className="mt-2 inline-flex items-center gap-1.5 text-sm" data-testid={`text-stay-rating-${stop.id}`}>
                  <Star className="h-3.5 w-3.5 fill-current text-primary" aria-hidden="true" />
                  {stop.stay.rating} / 5
                </p>
              )}
              {stop.stay.notes && <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground" data-testid={`text-stay-notes-${stop.id}`}>{stop.stay.notes}</p>}
            </>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">No accommodation is recorded for this stop.</p>
          )}
        </div>
        {!editing && stop.stay && (
          <div className="flex shrink-0 items-center gap-1">
            <button type="button" onClick={beginEdit} disabled={saving || remove.isPending}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
              data-testid={`button-edit-stay-${stop.id}`}><Pencil className="h-3.5 w-3.5" /> Edit</button>
            <button type="button" onClick={() => { setDeleteError(null); setDeleteOpen(true); }} disabled={saving || remove.isPending}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/5 disabled:opacity-50"
              data-testid={`button-delete-stay-${stop.id}`}><Trash2 className="h-3.5 w-3.5" /> Remove</button>
          </div>
        )}
      </div>

      {!editing && !stop.stay && (
        <button type="button" onClick={beginEdit} disabled={saving}
          className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          data-testid={`button-add-stay-${stop.id}`}><Plus className="h-4 w-4" /> Add accommodation</button>
      )}

      {editing && (
        <form className="mt-4 space-y-4 border-t border-dashed border-border pt-4" onSubmit={save} noValidate data-testid={`form-stay-${stop.id}`}>
          <div>
            <label htmlFor={`stay-type-${stop.id}`} className="text-sm font-medium">Accommodation type <span aria-hidden="true">*</span></label>
            <select id={`stay-type-${stop.id}`} value={values.accommodationType} required
              onChange={(event) => change("accommodationType", event.target.value)}
              aria-invalid={!!fields.accommodationType} aria-describedby={fields.accommodationType ? `stay-type-error-${stop.id}` : undefined}
              className="mt-1.5 h-10 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none focus:border-ring focus:ring-[3px] focus:ring-ring/15"
              data-testid={`select-stay-type-${stop.id}`}>
              <option value="">Choose a type…</option>
              {STAY_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
            {fields.accommodationType && <p id={`stay-type-error-${stop.id}`} role="alert" className="mt-1 text-xs text-destructive" data-testid={`error-stay-type-${stop.id}`}>{fields.accommodationType}</p>}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <DateField id={`stay-check-in-${stop.id}`} label="Check-in" value={values.checkIn} error={fields.checkIn}
              onChange={(value) => change("checkIn", value)} testId={`input-stay-check-in-${stop.id}`} />
            <DateField id={`stay-check-out-${stop.id}`} label="Check-out" value={values.checkOut} error={fields.checkOut}
              onChange={(value) => change("checkOut", value)} testId={`input-stay-check-out-${stop.id}`} />
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">Dates can be before or after the trip. Check-out must be later than check-in.</p>

          <div>
            <label htmlFor={`stay-rating-${stop.id}`} className="text-sm font-medium">Rating <span className="font-normal text-muted-foreground">(optional)</span></label>
            <select id={`stay-rating-${stop.id}`} value={values.rating} onChange={(event) => change("rating", event.target.value)}
              aria-invalid={!!fields.rating} aria-describedby={fields.rating ? `stay-rating-error-${stop.id}` : undefined}
              className="mt-1.5 h-10 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none focus:border-ring focus:ring-[3px] focus:ring-ring/15"
              data-testid={`select-stay-rating-${stop.id}`}>
              <option value="">No rating</option>
              {[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{rating} / 5</option>)}
            </select>
            {fields.rating && <p id={`stay-rating-error-${stop.id}`} role="alert" className="mt-1 text-xs text-destructive">{fields.rating}</p>}
          </div>

          <div>
            <label htmlFor={`stay-notes-${stop.id}`} className="text-sm font-medium">Notes <span className="font-normal text-muted-foreground">(optional)</span></label>
            <textarea id={`stay-notes-${stop.id}`} value={values.notes} onChange={(event) => change("notes", event.target.value)}
              rows={3} aria-invalid={!!fields.notes} aria-describedby={fields.notes ? `stay-notes-error-${stop.id}` : undefined}
              className="mt-1.5 w-full resize-y rounded-xl border border-input bg-card px-3 py-2 text-sm outline-none focus:border-ring focus:ring-[3px] focus:ring-ring/15"
              data-testid={`textarea-stay-notes-${stop.id}`} />
            {fields.notes && <p id={`stay-notes-error-${stop.id}`} role="alert" className="mt-1 text-xs text-destructive">{fields.notes}</p>}
          </div>

          {formError && <p role="alert" className="rounded-xl bg-destructive/5 p-3 text-sm text-destructive" data-testid={`error-stay-form-${stop.id}`}>{formError}</p>}
          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" disabled={saving || remove.isPending}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              data-testid={`button-save-stay-${stop.id}`}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{saving ? "Saving…" : stop.stay ? "Save changes" : "Save accommodation"}
            </button>
            <button type="button" onClick={() => { onDirtyChange(false); setEditing(false); setFields({}); setFormError(null); }}
              disabled={saving || remove.isPending} className="rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
              data-testid={`button-cancel-stay-${stop.id}`}>Cancel</button>
          </div>
        </form>
      )}

      <AlertDialog open={deleteOpen} onOpenChange={(open) => { if (!open && !remove.isPending) setDeleteOpen(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Remove this accommodation?</AlertDialogTitle>
            <AlertDialogDescription>
              The stay at “{stop.name}” will be deleted. The stop and trip will remain in your journal.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && <p role="alert" className="text-sm text-destructive" data-testid={`error-delete-stay-${stop.id}`}>{deleteError}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending} data-testid={`button-cancel-delete-stay-${stop.id}`}>Keep stay</AlertDialogCancel>
            <AlertDialogAction onClick={(event) => { event.preventDefault(); deleteStay(); }} disabled={remove.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-60"
              data-testid={`button-confirm-delete-stay-${stop.id}`}>
              {remove.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />} Remove stay
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function DateField({ id, label, value, error, onChange, testId }: {
  id: string; label: string; value: string; error?: string; onChange: (value: string) => void; testId: string;
}) {
  const errorId = `${id}-error`;
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium">{label} <span aria-hidden="true">*</span></label>
      <input id={id} type="date" value={value} required onChange={(event) => onChange(event.target.value)}
        aria-invalid={!!error} aria-describedby={error ? errorId : undefined}
        className="mt-1.5 h-10 w-full min-w-0 rounded-xl border border-input bg-card px-3 text-sm outline-none focus:border-ring focus:ring-[3px] focus:ring-ring/15"
        data-testid={testId} />
      {error && <p id={errorId} role="alert" className="mt-1 text-xs text-destructive" data-testid={`${testId}-error`}>{error}</p>}
    </div>
  );
}
