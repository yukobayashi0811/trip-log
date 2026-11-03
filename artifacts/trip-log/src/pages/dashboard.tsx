import { useMemo } from 'react';
import { Link } from 'wouter';
import { ArrowRight, BedDouble, BookOpen, MapPin } from 'lucide-react';
import { useGetDashboard, getGetDashboardQueryKey } from '@workspace/api-client-react';
import type { ReactNode } from 'react';
import { AppShell } from '@/components/app-shell';
import { ErrorPanel } from '@/components/trips/trip-states';
import { apiErrorInfo } from '@/lib/trips';
import { usePageMeta } from '@/lib/page-meta';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function monthLabel(ym: string): string {
  const [y, m] = ym.split('-');
  const idx = Number(m) - 1;
  return MONTHS[idx] ? `${MONTHS[idx]} ${y}` : ym;
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

function StatCard({ label, value, unit, icon, delay, testId }: { label: string; value: number; unit: string; icon: ReactNode; delay: number; testId: string }) {
  return (
    <div className="rise group rounded-2xl border border-card-border bg-card p-5 transition-transform duration-300 hover:-translate-y-0.5 md:p-6" style={{ animationDelay: `${delay}ms` }}>
      <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-accent-foreground transition-transform duration-300 group-hover:scale-110" aria-hidden="true">{icon}</span>
        {label}
      </dt>
      <dd className="mt-4 flex items-baseline gap-2">
        <span className="font-display text-5xl tabular-nums" data-testid={testId}>{value.toLocaleString()}</span>
        <span className="text-sm text-muted-foreground">{unit}</span>
      </dd>
    </div>
  );
}

export default function DashboardPage({ userId }: { userId: string }) {
  usePageMeta('Dashboard — Trip Log', 'Your journal at a glance.');
  const q = useGetDashboard({ query: { queryKey: [...getGetDashboardQueryKey(), userId], retry: false, refetchOnMount: 'always', refetchOnWindowFocus: true } });
  const d = q.data;
  const months = useMemo(
    () => (d?.tripsByMonth ?? []).filter((r) => r.tripCount > 0).slice().sort((a, b) => a.month.localeCompare(b.month)),
    [d],
  );
  const maxMonthlyTrips = months.reduce((max, row) => Math.max(max, row.tripCount), 1);

  return (
    <AppShell>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Your journal</p>
      <h1 className="font-display mt-2 text-4xl md:text-5xl">At a glance</h1>
      <p className="mt-2 text-muted-foreground">Everything you've recorded so far, across every year.</p>

      <section className="mt-8" aria-live="polite">
        {q.isLoading ? (
          <div aria-busy="true" aria-label="Loading dashboard" data-testid="status-loading">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {[0, 1, 2].map((i) => <div key={i} className="h-32 animate-pulse rounded-2xl bg-muted" />)}
            </div>
            <div className="mt-10 h-56 animate-pulse rounded-2xl bg-muted" />
          </div>
        ) : q.isError || !d ? (
          <ErrorPanel title="Your dashboard didn't load" message={apiErrorInfo(q.error).message.replace('saving', 'loading')} onRetry={() => q.refetch()} retrying={q.isFetching} />
        ) : (
          <>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatCard label="Trips" value={d.totalTrips} unit={d.totalTrips === 1 ? 'journey' : 'journeys'} icon={<BookOpen className="h-4 w-4" />} delay={0} testId="text-total-trips" />
              <StatCard label="Stops" value={d.totalStops} unit={d.totalStops === 1 ? 'place' : 'places'} icon={<MapPin className="h-4 w-4" />} delay={80} testId="text-total-stops" />
              <StatCard label="Nights" value={d.totalAccommodationNights} unit={d.totalAccommodationNights === 1 ? 'night stayed' : 'nights stayed'} icon={<BedDouble className="h-4 w-4" />} delay={160} testId="text-total-nights" />
            </dl>

            <div className="rise mt-10 rounded-2xl border border-card-border bg-card p-5 md:p-7" style={{ animationDelay: '220ms' }}>
              <h2 className="font-display text-2xl">Trips by start month</h2>
              <p className="mt-1 text-sm text-muted-foreground">Counted by the month each trip began, not the dates you stayed anywhere. Months without a trip start are left out.</p>
              {months.length === 0 ? (
                <div className="mt-6 rounded-xl border border-dashed border-border bg-background/60 p-6 text-center" data-testid="status-empty">
                  <p className="font-display text-xl">No trips recorded yet</p>
                  <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">Once you log a journey, its start month will show up here.</p>
                  <Link href="/trips/new" className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-transform hover:bg-primary/90 active:scale-[0.98]" data-testid="link-dashboard-new-trip">
                    Log your first trip <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              ) : (
                <>
                  <figure className="mt-5" data-testid="chart-trips-by-month">
                    <figcaption className="sr-only">Horizontal bars compare trips by start month. Exact totals are shown beside each month.</figcaption>
                    <ol className="space-y-3" aria-label="Trips by start month">
                      {months.map((r) => (
                        <li key={r.month} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 sm:grid-cols-[10rem_minmax(0,1fr)_5rem]" data-testid={`bar-month-${r.month}`}>
                          <span className="min-w-0 text-sm font-medium leading-tight">{monthLabel(r.month)}</span>
                          <span className="text-right text-sm tabular-nums sm:col-start-3 sm:row-start-1">{plural(r.tripCount, 'trip', 'trips')}</span>
                          <div className="col-span-2 h-3 overflow-hidden rounded-full bg-muted sm:col-start-2 sm:col-span-1 sm:row-start-1" aria-hidden="true">
                            <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${(r.tripCount / maxMonthlyTrips) * 100}%` }} />
                          </div>
                        </li>
                      ))}
                    </ol>
                  </figure>
                  <div className="mt-8 overflow-x-auto">
                    <table className="w-full border-collapse text-sm" data-testid="table-trips-by-month">
                      <caption className="sr-only">Number of trips by start month, oldest first</caption>
                      <thead>
                        <tr className="border-b border-border text-left text-xs uppercase tracking-[0.14em] text-muted-foreground">
                          <th scope="col" className="py-2 pr-4 font-semibold">Start month</th>
                          <th scope="col" className="py-2 text-right font-semibold">Trips</th>
                        </tr>
                      </thead>
                      <tbody>
                        {months.map((r) => (
                          <tr key={r.month} className="group border-b border-border/60 transition-colors last:border-0 hover:bg-accent/40" data-testid={`row-month-${r.month}`}>
                            <th scope="row" className="py-3 pr-4 text-left font-medium">{monthLabel(r.month)}</th>
                            <td className="py-3 text-right">
                              <span className="inline-flex items-center justify-end gap-3">
                                <span className="tabular-nums">{plural(r.tripCount, 'trip', 'trips')}</span>
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </section>
    </AppShell>
  );
}
