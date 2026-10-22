import { Link } from 'wouter';
import { Plus } from 'lucide-react';
import { useListTrips, getListTripsQueryKey } from '@workspace/api-client-react';
import { AppShell } from '@/components/app-shell';
import { ErrorPanel } from '@/components/trips/trip-states';
import { TripRow } from '@/components/trips/trip-row';
import { apiErrorInfo } from '@/lib/trips';
import { usePageMeta } from '@/lib/page-meta';

function NewTripLink({ testId }: { testId: string }) {
  return (
    <Link href="/trips/new" className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-transform hover:bg-primary/90 active:scale-[0.98]" data-testid={testId}>
      <Plus className="h-4 w-4" /> New trip
    </Link>
  );
}

export default function TripsListPage({ userId }: { userId: string }) {
  usePageMeta('All trips — Trip Log', 'Every journey in your private Trip Log.');
  const q = useListTrips({ query: { queryKey: [...getListTripsQueryKey(), userId], retry: false, refetchOnMount: 'always', refetchOnWindowFocus: true } });
  const trips = q.data;

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Your journal</p>
          <h1 className="font-display mt-2 text-4xl md:text-5xl">All trips</h1>
          {trips && trips.length > 0 && <p className="mt-2 text-muted-foreground" data-testid="text-trip-count">{trips.length} {trips.length === 1 ? 'journey' : 'journeys'}, newest first.</p>}
        </div>
        {trips && trips.length > 0 && <NewTripLink testId="link-new-trip" />}
      </div>

      <section className="mt-10">
        {q.isLoading ? (
          <ul className="space-y-3" aria-busy="true" aria-label="Loading trips" data-testid="status-loading">
            {[0, 1, 2, 3].map((i) => (
              <li key={i} className="flex items-center gap-5 px-3 py-4">
                <div className="h-14 w-12 animate-pulse rounded-lg bg-muted" />
                <div className="flex-1 space-y-2"><div className="h-5 w-1/2 animate-pulse rounded bg-muted" /><div className="h-4 w-1/3 animate-pulse rounded bg-muted" /></div>
              </li>
            ))}
          </ul>
        ) : q.isError || !trips ? (
          <ErrorPanel title="Your trips didn't load" message={apiErrorInfo(q.error).message.replace('saving', 'loading')} onRetry={() => q.refetch()} retrying={q.isFetching} />
        ) : trips.length === 0 ? (
          <div className="rise grid items-center gap-8 rounded-[2rem] border border-dashed border-border bg-card/60 p-8 md:grid-cols-[1fr_auto] md:p-12" data-testid="status-empty">
            <div>
              <h2 className="font-display text-3xl">The first page is blank</h2>
              <p className="mt-3 max-w-md leading-relaxed text-muted-foreground">Start with one journey you remember well: when it began, when you came home, and what's worth keeping.</p>
              <div className="mt-6"><NewTripLink testId="link-new-trip-empty" /></div>
            </div>
            <svg viewBox="0 0 180 120" className="hidden w-44 md:block" aria-hidden="true">
              <path className="route-draw" d="M15 100 C 50 70, 40 40, 90 45 S 150 30, 165 15" fill="none" stroke="hsl(174 42% 30%)" strokeWidth="2.5" strokeDasharray="2 8" strokeLinecap="round" />
              <circle cx="15" cy="100" r="6" fill="hsl(42 45% 98%)" stroke="hsl(174 42% 28%)" strokeWidth="2.5" />
            </svg>
          </div>
        ) : (
          <ul className="-mx-3 divide-y divide-border/60 md:-mx-5" data-testid="list-trips">
            {trips.map((t, i) => <TripRow key={t.id} trip={t} index={i} />)}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
