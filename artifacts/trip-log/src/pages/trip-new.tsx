import { Link, useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { useCreateTrip, getListTripsQueryKey, getGetTripQueryKey } from '@workspace/api-client-react';
import { AppShell } from '@/components/app-shell';
import { TripForm } from '@/components/trips/trip-form';
import { apiErrorInfo, emptyTripValues, valuesToInput } from '@/lib/trips';
import { usePageMeta } from '@/lib/page-meta';

export default function TripNewPage({ userId }: { userId: string }) {
  usePageMeta('New trip — Trip Log', 'Record a new journey.');
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const create = useCreateTrip();
  const info = create.isError ? apiErrorInfo(create.error) : null;

  return (
    <AppShell width="max-w-3xl">
      <Link href="/trips" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground" data-testid="link-back-trips"><ArrowLeft className="h-4 w-4" /> All trips</Link>
      <h1 className="font-display mt-4 text-4xl md:text-5xl">A new trip</h1>
      <p className="mt-2 text-muted-foreground">Title and dates are enough to begin. The rest can wait.</p>
      <div className="mt-8 rounded-[1.75rem] border border-card-border bg-card p-5 md:p-9">
        <TripForm
          initial={emptyTripValues}
          submitLabel="Save trip"
          pendingLabel="Saving…"
          pending={create.isPending}
          serverError={info?.message ?? null}
          serverFields={info?.fields ?? {}}
          cancelHref="/trips"
          onSubmit={(v) => create.mutate({ data: valuesToInput(v) }, {
            onSuccess: (trip) => {
              qc.setQueryData([...getGetTripQueryKey(trip.id), userId], trip);
              qc.invalidateQueries({ queryKey: getListTripsQueryKey() });
              setLocation(`/trips/${trip.id}`);
            },
          })}
        />
      </div>
    </AppShell>
  );
}
