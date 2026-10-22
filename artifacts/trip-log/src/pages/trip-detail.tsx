import type { ReactNode } from 'react';
import { Link, useParams } from 'wouter';
import { ArrowLeft, CalendarRange, Compass, Map as MapIcon, MapPin, Pencil } from 'lucide-react';
import { useGetTrip, getGetTripQueryKey } from '@workspace/api-client-react';
import { AppShell } from '@/components/app-shell';
import { DeleteTripDialog } from '@/components/trips/delete-trip-dialog';
import { DetailSkeleton, ErrorPanel, TripNotFound } from '@/components/trips/trip-states';
import { apiErrorInfo, errorStatus, formatDate, tripDays } from '@/lib/trips';
import { usePageMeta } from '@/lib/page-meta';

function Fact({ icon, label, value, testId }: { icon: ReactNode; label: string; value: string | null; testId: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 text-primary">{icon}</div>
      <div className="min-w-0">
        <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</dt>
        <dd className={`mt-1 break-words ${value ? '' : 'italic text-muted-foreground'}`} data-testid={testId}>{value ?? 'Not recorded'}</dd>
      </div>
    </div>
  );
}

export default function TripDetailPage({ userId }: { userId: string }) {
  const { id = '' } = useParams<{ id: string }>();
  const q = useGetTrip(id, { query: { enabled: !!id, queryKey: [...getGetTripQueryKey(id), userId], retry: false, refetchOnMount: 'always', refetchOnWindowFocus: true } });
  const trip = q.data;
  usePageMeta(trip ? `${trip.title} — Trip Log` : 'Trip — Trip Log', 'A trip in your private journal.');

  let body: ReactNode;
  if (q.isLoading) body = <DetailSkeleton />;
  else if (q.isError && errorStatus(q.error) === 404) body = <TripNotFound />;
  else if (q.isError || !trip) body = <ErrorPanel title="This trip didn't load" message={apiErrorInfo(q.error).message.replace('saving', 'loading')} onRetry={() => q.refetch()} retrying={q.isFetching} />;
  else {
    const days = tripDays(trip.startDate, trip.endDate);
    body = (
      <article className="rise">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            {trip.tripType && <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary" data-testid="text-trip-type-eyebrow">{trip.tripType}</p>}
            <h1 className="font-display mt-2 break-words text-4xl leading-tight md:text-5xl" data-testid="text-trip-title">{trip.title}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/trips/${trip.id}/map`} className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90" data-testid="link-trip-map"><MapIcon className="h-4 w-4" /> Map</Link>
            <Link href={`/trips/${trip.id}/edit`} className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-card" data-testid="link-edit-trip"><Pencil className="h-4 w-4" /> Edit</Link>
            <DeleteTripDialog tripId={trip.id} title={trip.title} />
          </div>
        </div>
        <dl className="mt-8 grid gap-6 rounded-[1.75rem] border border-card-border bg-card p-6 sm:grid-cols-2 md:p-8">
          <Fact icon={<CalendarRange className="h-4 w-4" />} label="Start date" value={formatDate(trip.startDate, true)} testId="text-start-date" />
          <Fact icon={<CalendarRange className="h-4 w-4" />} label={days ? `End date · ${days} ${days === 1 ? 'day' : 'days'}` : 'End date'} value={formatDate(trip.endDate, true)} testId="text-end-date" />
          <Fact icon={<MapPin className="h-4 w-4" />} label="Region" value={trip.destinationRegion} testId="text-region" />
          <Fact icon={<Compass className="h-4 w-4" />} label="Trip type" value={trip.tripType} testId="text-trip-type" />
        </dl>
        <section className="mt-10">
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Notes</h2>
          {trip.notes ? (
            <p className="font-display mt-4 whitespace-pre-wrap break-words text-lg leading-[1.8] text-foreground/90" data-testid="text-notes">{trip.notes}</p>
          ) : (
            <p className="mt-4 italic text-muted-foreground" data-testid="text-notes-empty">No notes yet. <Link href={`/trips/${trip.id}/edit`} className="not-italic font-medium text-primary underline-offset-4 hover:underline" data-testid="link-add-notes">Add some</Link></p>
          )}
        </section>
        <p className="mt-12 border-t border-dashed border-border pt-4 text-xs text-muted-foreground" data-testid="text-created-at">Logged {new Date(trip.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </article>
    );
  }

  return (
    <AppShell width="max-w-3xl">
      <Link href="/trips" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground" data-testid="link-back-trips"><ArrowLeft className="h-4 w-4" /> All trips</Link>
      {body}
    </AppShell>
  );
}
