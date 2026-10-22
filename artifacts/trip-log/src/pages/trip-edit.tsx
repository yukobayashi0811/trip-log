import type { ReactNode } from 'react';
import { Link, useLocation, useParams } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { useGetTrip, useUpdateTrip, getGetTripQueryKey, getListTripsQueryKey } from '@workspace/api-client-react';
import { AppShell } from '@/components/app-shell';
import { TripForm } from '@/components/trips/trip-form';
import { DetailSkeleton, ErrorPanel, TripNotFound } from '@/components/trips/trip-states';
import { apiErrorInfo, errorStatus, tripToValues, valuesToInput } from '@/lib/trips';
import { usePageMeta } from '@/lib/page-meta';

export default function TripEditPage({ userId }: { userId: string }) {
  usePageMeta('Edit trip — Trip Log', 'Edit a trip in your private journal.');
  const { id = '' } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const q = useGetTrip(id, { query: { enabled: !!id, queryKey: [...getGetTripQueryKey(id), userId], retry: false, refetchOnMount: 'always', refetchOnWindowFocus: false } });
  const update = useUpdateTrip();
  const info = update.isError ? apiErrorInfo(update.error) : null;
  const trip = q.data;
  const ready = !!trip && !q.isFetching;

  let body: ReactNode;
  if (q.isLoading || (trip && !ready && !q.isError)) body = <DetailSkeleton />;
  else if (q.isError && errorStatus(q.error) === 404) body = <TripNotFound />;
  else if (q.isError || !trip) body = <ErrorPanel title="This trip didn't load" message={apiErrorInfo(q.error).message.replace('saving', 'loading')} onRetry={() => q.refetch()} retrying={q.isFetching} />;
  else body = (
    <>
      <h1 className="font-display mt-4 break-words text-4xl md:text-5xl">Edit trip</h1>
      <p className="mt-2 text-muted-foreground">Clear any optional field to remove it.</p>
      <div className="mt-8 rounded-[1.75rem] border border-card-border bg-card p-5 md:p-9">
        <TripForm
          key={trip.id}
          initial={tripToValues(trip)}
          submitLabel="Save changes"
          pendingLabel="Saving…"
          pending={update.isPending}
          serverError={info?.message ?? null}
          serverFields={info?.fields ?? {}}
          cancelHref={`/trips/${trip.id}`}
          onSubmit={(v) => update.mutate({ id: trip.id, data: valuesToInput(v) }, {
            onSuccess: (saved) => {
              qc.setQueryData([...getGetTripQueryKey(saved.id), userId], saved);
              qc.invalidateQueries({ queryKey: getGetTripQueryKey(saved.id) });
              qc.invalidateQueries({ queryKey: getListTripsQueryKey() });
              setLocation(`/trips/${saved.id}`);
            },
          })}
        />
      </div>
    </>
  );

  return (
    <AppShell width="max-w-3xl">
      <Link href={id ? `/trips/${id}` : '/trips'} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground" data-testid="link-back-trip"><ArrowLeft className="h-4 w-4" /> Back to trip</Link>
      {body}
    </AppShell>
  );
}
