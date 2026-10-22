import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getListStopsQueryKey, getGetTripRoutesQueryKey, useGetTripRoutes, type Stop } from '@workspace/api-client-react';
import { drivingSections, routingRevision } from '@workspace/api-zod';
import { Loader2, RotateCw } from 'lucide-react';

export function useRoadRoutes(tripId: string, userId: string, stops: Stop[], enabled: boolean) {
  const qc = useQueryClient();
  const revision = useMemo(() => routingRevision(stops), [stops]);
  const sections = useMemo(() => drivingSections(stops).length, [stops]);
  const requestKey = `${tripId}:${revision}`;
  const [settled, setSettled] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setSettled(requestKey), 650);
    return () => clearTimeout(timer);
  }, [requestKey]);
  const canLoad = enabled && sections > 0 && settled === requestKey;
  const query = useGetTripRoutes(tripId, { query: {
    queryKey: [...getGetTripRoutesQueryKey(tripId), userId, revision],
    enabled: canLoad, retry: false, staleTime: 5 * 60_000, gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  } });
  useEffect(() => {
    // A concurrent session can change stops between the list and route reads.
    // Never put that response over a different itinerary; fetch the saved list.
    if (canLoad && query.data && query.data.stopRevision !== revision) {
      void qc.invalidateQueries({ queryKey: [...getListStopsQueryKey(tripId), userId] });
    }
  }, [canLoad, query.data, revision, qc, tripId, userId]);
  const data = canLoad && !query.isError && !query.isFetching && query.data?.stopRevision === revision ? query.data : undefined;
  const [clock, setClock] = useState(Date.now());
  const retrySeconds = Math.max(0, ...((query.data?.segments ?? []).map(s => s.retryAfterSeconds ?? 0)));
  useEffect(() => {
    if (!retrySeconds) return;
    setClock(Date.now());
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [retrySeconds, query.dataUpdatedAt]);
  const wait = Math.max(0, Math.ceil((query.dataUpdatedAt + retrySeconds * 1000 - clock) / 1000));
  return { data, sections, wait, loading: enabled && sections > 0 && (!canLoad || query.isFetching || (!query.isError && !data)),
    error: query.isError, syncing: !enabled, retry: () => query.refetch() };
}

export function RoadRoutingStatus({ routing }: { routing: ReturnType<typeof useRoadRoutes> }) {
  const { data, sections, wait, loading, syncing, error } = routing;
  const failures = data?.segments.filter(s => s.status !== 'ready') ?? [];
  const messages = [...new Set(failures.map(s => s.message))];
  const ready = data?.segments.filter(s => s.status === 'ready') ?? [];
  const km = ready.reduce((sum, s) => sum + (s.distanceMeters ?? 0), 0) / 1000;
  const minutes = Math.round(ready.reduce((sum, s) => sum + (s.durationSeconds ?? 0), 0) / 60);
  return (
    <section className="mt-4 rounded-2xl border border-card-border bg-card/70 p-4 text-sm" aria-label="Driving routes" data-testid="routing-status">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Estimated Driving Route</h2>
        {(failures.length > 0 || error) && <button type="button" onClick={() => void routing.retry()}
          disabled={loading || syncing || wait > 0} data-testid="button-retry-routing"
          className="inline-flex min-h-10 items-center gap-2 rounded-full border border-border px-3 text-xs font-medium disabled:opacity-50">
          <RotateCw className="h-3.5 w-3.5" />{wait ? `Try again in ${wait}s` : 'Retry routing'}
        </button>}
      </div>
      <div role="status" aria-live="polite" className="mt-2 space-y-1 text-muted-foreground">
        {syncing ? <p>Waiting for the saved itinerary. Your stop markers are unaffected.</p>
          : !sections ? <p>Connect consecutive saved stops with Driving to estimate roads. Flying, Other and unmarked transitions have no lines.</p>
            : loading ? <p><Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />Estimating roads for the saved itinerary…</p>
              : error ? <p>Routes could not be loaded. Check your connection or sign in again, then retry. Your stops are safe.</p>
                : <>{ready.length > 0 && <p>{ready.length} of {data?.segments.length} driving sections shown · {km.toLocaleString(undefined, { maximumFractionDigits: 1 })} km · about {minutes} min</p>}
                  {messages.map(message => <p key={message}>{message}</p>)}</>}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Estimated roads, not recorded GPS or navigation advice. Only driving coordinates are sent to openrouteservice; no flight or Other lines.</p>
      <p className="mt-2 text-xs text-muted-foreground">
        © <a className="underline" href="https://openrouteservice.org/" target="_blank" rel="noreferrer">openrouteservice by HeiGIT</a> | Data from <a className="underline" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> · <a className="underline" href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">CC BY-SA 4.0</a>
      </p>
    </section>
  );
}
