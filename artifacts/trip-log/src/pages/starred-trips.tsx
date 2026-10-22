import { Link } from 'wouter';
import { ArrowRight, Star } from 'lucide-react';
import {
  getGetStarredTripsQueryKey,
  useGetStarredTrips,
} from '@workspace/api-client-react';
import { AppShell } from '@/components/app-shell';
import { ErrorPanel } from '@/components/trips/trip-states';
import { TripRow } from '@/components/trips/trip-row';
import { apiErrorInfo } from '@/lib/trips';
import { usePageMeta } from '@/lib/page-meta';

export default function StarredTripsPage({ userId }: { userId: string }) {
  usePageMeta('Starred trips — Trip Log', 'Your favorite journeys in your private Trip Log.');
  const q = useGetStarredTrips({
    query: {
      queryKey: [...getGetStarredTripsQueryKey(), userId],
      retry: false,
      refetchOnMount: 'always',
      refetchOnWindowFocus: true,
    },
  });

  return (
    <AppShell>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Your journal</p>
        <h1 className="font-display mt-2 flex items-center gap-3 text-4xl md:text-5xl">
          Starred trips <Star className="h-7 w-7 fill-current text-primary" aria-hidden="true" />
        </h1>
        {q.data && q.data.length > 0 && (
          <p className="mt-2 text-muted-foreground">{q.data.length} saved {q.data.length === 1 ? 'favorite' : 'favorites'}.</p>
        )}
      </div>

      <section className="mt-10" aria-label="Starred trips">
        {q.isLoading ? (
          <ul className="space-y-3" aria-busy="true" aria-label="Loading starred trips" data-testid="status-loading-starred">
            {[0, 1, 2].map((i) => (
              <li key={i} className="flex items-center gap-5 px-3 py-4">
                <div className="h-14 w-12 animate-pulse rounded-lg bg-muted" />
                <div className="flex-1 space-y-2"><div className="h-5 w-1/2 animate-pulse rounded bg-muted" /><div className="h-4 w-1/3 animate-pulse rounded bg-muted" /></div>
              </li>
            ))}
          </ul>
        ) : q.isError || !q.data ? (
          <ErrorPanel
            title="Starred trips didn't load"
            message={apiErrorInfo(q.error).message.replace('saving', 'loading')}
            onRetry={() => q.refetch()}
            retrying={q.isFetching}
          />
        ) : q.data.length === 0 ? (
          <div className="rise rounded-[2rem] border border-dashed border-border bg-card/60 p-8 text-center md:p-12" data-testid="status-empty-starred">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent text-primary">
              <Star className="h-6 w-6" aria-hidden="true" />
            </div>
            <h2 className="font-display mt-5 text-3xl">No starred trips yet</h2>
            <p className="mx-auto mt-3 max-w-md leading-relaxed text-muted-foreground">Star a journey from All Trips or its detail page, and it will be ready to find here.</p>
            <Link href="/trips" className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid="link-empty-starred-trips">
              Browse all trips <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        ) : (
          <ul className="-mx-3 divide-y divide-border/60 md:-mx-5" data-testid="list-starred-trips">
            {q.data.map((trip, index) => (
              <TripRow key={trip.id} trip={trip} index={index} userId={userId} isStarred />
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
