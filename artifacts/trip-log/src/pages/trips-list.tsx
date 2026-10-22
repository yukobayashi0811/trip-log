import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { Plus, RotateCcw } from 'lucide-react';
import { useGetStarredTrips, useListTrips, getGetStarredTripsQueryKey, getListTripsQueryKey } from '@workspace/api-client-react';
import { AppShell } from '@/components/app-shell';
import { ErrorPanel } from '@/components/trips/trip-states';
import { TripRow } from '@/components/trips/trip-row';
import { apiErrorInfo } from '@/lib/trips';
import { usePageMeta } from '@/lib/page-meta';
import { Input } from '@/components/ui/input';
import { filterAndSortTrips, tripRegionOptions, tripYearOptions } from '@/lib/trip-search';

type SortOrder = 'newest' | 'oldest';

const initialFilters = {
  query: '',
  region: '',
  year: '',
  starredOnly: false,
  sortOrder: 'newest' as SortOrder,
};

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
  const starredQ = useGetStarredTrips({ query: { queryKey: [...getGetStarredTripsQueryKey(), userId], retry: false, refetchOnMount: 'always', refetchOnWindowFocus: true } });
  const trips = q.data;
  const [query, setQuery] = useState(initialFilters.query);
  const [region, setRegion] = useState(initialFilters.region);
  const [year, setYear] = useState(initialFilters.year);
  const [starredOnly, setStarredOnly] = useState(initialFilters.starredOnly);
  const [sortOrder, setSortOrder] = useState<SortOrder>(initialFilters.sortOrder);
  const starredTripIds = useMemo(() => new Set((starredQ.data ?? []).map((trip) => trip.id)), [starredQ.data]);
  const regionOptions = useMemo(() => tripRegionOptions(trips ?? []), [trips]);
  const yearOptions = useMemo(() => tripYearOptions(trips ?? []), [trips]);
  const filteredTrips = useMemo(
    () => filterAndSortTrips(trips ?? [], starredTripIds, { query, region, year, starredOnly, sortOrder }),
    [trips, starredTripIds, query, region, year, starredOnly, sortOrder],
  );
  const hasActiveFilters = !!query.trim() || !!region || !!year || starredOnly;
  const hasNonDefaultSort = sortOrder !== initialFilters.sortOrder;
  const clearFilters = () => {
    setQuery(initialFilters.query);
    setRegion(initialFilters.region);
    setYear(initialFilters.year);
    setStarredOnly(initialFilters.starredOnly);
    setSortOrder(initialFilters.sortOrder);
  };

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Your journal</p>
          <h1 className="font-display mt-2 text-4xl md:text-5xl">All trips</h1>
          {trips && trips.length > 0 && (
            <p className="mt-2 text-muted-foreground" data-testid="text-trip-count" aria-live="polite">
              {hasActiveFilters
                ? `${filteredTrips.length} matching ${filteredTrips.length === 1 ? 'trip' : 'trips'}`
                : `${trips.length} ${trips.length === 1 ? 'journey' : 'journeys'}, ${sortOrder} first.`}
            </p>
          )}
        </div>
        {trips && trips.length > 0 && <NewTripLink testId="link-new-trip" />}
      </div>

      {trips && trips.length > 0 && (
        <section className="mt-6 rounded-2xl border border-border/70 bg-card/50 p-4 md:p-5" aria-label="Search and filter trips">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
            <div className="sm:col-span-2">
              <label htmlFor="trip-title-search" className="mb-1.5 block text-sm font-medium">Search by title</label>
              <Input
                id="trip-title-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search trips"
                autoComplete="off"
                data-testid="input-trip-search"
              />
            </div>
            <div>
              <label htmlFor="trip-region-filter" className="mb-1.5 block text-sm font-medium">Region</label>
              <select id="trip-region-filter" value={region} onChange={(event) => setRegion(event.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid="select-trip-region">
                <option value="">All regions</option>
                {regionOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="trip-year-filter" className="mb-1.5 block text-sm font-medium">Start year</label>
              <select id="trip-year-filter" value={year} onChange={(event) => setYear(event.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid="select-trip-year">
                <option value="">Any year</option>
                {yearOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="trip-sort-order" className="mb-1.5 block text-sm font-medium">Sort by date</label>
              <select id="trip-sort-order" value={sortOrder} onChange={(event) => setSortOrder(event.target.value as SortOrder)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid="select-trip-sort">
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
            </div>
            <div className="flex items-end">
              <label htmlFor="trip-starred-filter" className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-1 text-sm font-medium focus-within:outline-none focus-within:ring-2 focus-within:ring-ring">
                <input
                  id="trip-starred-filter"
                  type="checkbox"
                  checked={starredOnly}
                  onChange={(event) => setStarredOnly(event.target.checked)}
                  className="h-4 w-4 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  data-testid="checkbox-starred-only"
                />
                Starred only
              </label>
            </div>
          </div>
          {(hasActiveFilters || hasNonDefaultSort) && (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-medium text-primary hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              data-testid="button-clear-trip-filters"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Clear all
            </button>
          )}
        </section>
      )}

      <section className="mt-10">
        {q.isLoading || starredQ.isLoading ? (
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
        ) : starredQ.isError || !starredQ.data ? (
          <ErrorPanel title="Star status didn't load" message="Your trips are safe, but star status couldn't be checked. Retry to see the latest saved state." onRetry={() => starredQ.refetch()} retrying={starredQ.isFetching} />
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
        ) : filteredTrips.length === 0 ? (
          <div className="rise rounded-[2rem] border border-dashed border-border bg-card/60 p-8 text-center md:p-12" data-testid="status-no-matching-trips">
            <h2 className="font-display text-3xl">No trips match your search</h2>
            <p className="mx-auto mt-3 max-w-md leading-relaxed text-muted-foreground">Try another title, region, year, or star filter.</p>
            {(hasActiveFilters || hasNonDefaultSort) && (
              <button type="button" onClick={clearFilters} className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid="button-clear-trip-filters-empty">
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <ul className="-mx-3 divide-y divide-border/60 md:-mx-5" data-testid="list-trips">
            {filteredTrips.map((t, i) => <TripRow key={t.id} trip={t} index={i} userId={userId} isStarred={starredTripIds.has(t.id)} />)}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
