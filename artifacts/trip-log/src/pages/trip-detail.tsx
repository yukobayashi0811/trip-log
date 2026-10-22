import type { ReactNode } from 'react';
import { Link, useParams } from 'wouter';
import { ArrowLeft, BedDouble, CalendarRange, Compass, Map as MapIcon, MapPin, Pencil, Star } from 'lucide-react';
import { useGetStarredTrips, useGetTrip, useListStops, getGetStarredTripsQueryKey, getGetTripQueryKey, getListStopsQueryKey } from '@workspace/api-client-react';
import { AppShell } from '@/components/app-shell';
import { DeleteTripDialog } from '@/components/trips/delete-trip-dialog';
import { DetailSkeleton, ErrorPanel, TripNotFound } from '@/components/trips/trip-states';
import { apiErrorInfo, errorStatus, formatDate, tripDays } from '@/lib/trips';
import { usePageMeta } from '@/lib/page-meta';
import { TripStarButton } from '@/components/trips/trip-star-button';

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
  const stopsQ = useListStops(id, { query: { enabled: !!id, queryKey: [...getListStopsQueryKey(id), userId], retry: false, refetchOnMount: 'always', refetchOnWindowFocus: true } });
  const starredQ = useGetStarredTrips({ query: { queryKey: [...getGetStarredTripsQueryKey(), userId], retry: false, refetchOnMount: 'always', refetchOnWindowFocus: true } });
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
            <TripStarButton
              tripId={trip.id}
              userId={userId}
              isStarred={starredQ.data?.some((starred) => starred.id === trip.id)}
              loading={starredQ.isLoading}
              error={starredQ.isError}
              onRetry={() => starredQ.refetch()}
            />
            <DeleteTripDialog tripId={trip.id} title={trip.title} />
          </div>
        </div>
        <dl className="mt-8 grid gap-6 rounded-[1.75rem] border border-card-border bg-card p-6 sm:grid-cols-2 md:p-8">
          <Fact icon={<CalendarRange className="h-4 w-4" />} label="Start date" value={formatDate(trip.startDate, true)} testId="text-start-date" />
          <Fact icon={<CalendarRange className="h-4 w-4" />} label={days ? `End date · ${days} ${days === 1 ? 'day' : 'days'}` : 'End date'} value={formatDate(trip.endDate, true)} testId="text-end-date" />
          <Fact icon={<MapPin className="h-4 w-4" />} label="Region" value={trip.destinationRegion} testId="text-region" />
          <Fact icon={<Compass className="h-4 w-4" />} label="Trip type" value={trip.tripType} testId="text-trip-type" />
        </dl>
        <section className="mt-10" aria-labelledby="trip-itinerary-heading" data-testid="section-trip-itinerary">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="trip-itinerary-heading" className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Itinerary & overnight stays</h2>
              <p className="mt-1 text-sm text-muted-foreground">Stops and accommodations saved for this trip.</p>
            </div>
            <Link href={`/trips/${trip.id}/map`} className="text-sm font-medium text-primary underline-offset-4 hover:underline" data-testid="link-itinerary-map">Open map</Link>
          </div>
          {stopsQ.isLoading ? (
            <p className="mt-4 text-sm text-muted-foreground" role="status" data-testid="status-loading-itinerary">Loading itinerary…</p>
          ) : stopsQ.isError ? (
            <p className="mt-4 rounded-xl bg-destructive/5 p-3 text-sm text-destructive" role="status" data-testid="error-loading-itinerary">The itinerary could not be loaded. <Link href={`/trips/${trip.id}/map`} className="font-medium underline">Try it on the map</Link>.</p>
          ) : stopsQ.data?.length ? (
            <ol className="mt-4 space-y-3" data-testid="list-trip-itinerary">
              {stopsQ.data.map((stop, index) => (
                <li key={stop.id} className="rounded-2xl border border-card-border bg-card p-4" data-testid={`row-trip-stop-${stop.id}`}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <h3 className="font-medium">{index + 1}. {stop.name}</h3>
                    {stop.visitDate && <span className="text-xs text-muted-foreground">{formatDate(stop.visitDate, true)}</span>}
                  </div>
                  {stop.stay ? (
                    <div className="mt-3 rounded-xl bg-background/70 p-3" data-testid={`summary-trip-stay-${stop.id}`}>
                      <p className="flex items-center gap-2 text-sm font-medium"><BedDouble className="h-4 w-4 text-primary" />{stop.stay.accommodationType}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{formatDate(stop.stay.checkIn, true)} – {formatDate(stop.stay.checkOut, true)}</p>
                      {stop.stay.rating !== null && <p className="mt-1 inline-flex items-center gap-1 text-sm text-muted-foreground"><Star className="h-3.5 w-3.5 fill-current text-primary" aria-hidden="true" />{stop.stay.rating} / 5</p>}
                      {stop.stay.notes && <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed">{stop.stay.notes}</p>}
                    </div>
                  ) : <p className="mt-1 text-sm text-muted-foreground">No accommodation recorded.</p>}
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-4 italic text-muted-foreground" data-testid="text-empty-itinerary">No stops have been added yet.</p>
          )}
        </section>
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
