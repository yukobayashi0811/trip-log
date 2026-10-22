import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useParams } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowDown, ArrowUp, BedDouble, BookOpen, CalendarDays, ChevronDown, ChevronUp, Loader2, MapPinned, PanelRightClose, PanelRightOpen, Pencil, Plus, Trash2, TriangleAlert,
} from 'lucide-react';
import {
  useListTrips, useGetTrip, useListStops, useGetStop, useCreateStop, useUpdateStop, useDeleteStop, useReorderStops,
  getListTripsQueryKey, getGetTripQueryKey, getListStopsQueryKey, getGetStopQueryKey, type Stop,
} from '@workspace/api-client-react';
import { AppShell } from '@/components/app-shell';
import { ErrorPanel, TripNotFound } from '@/components/trips/trip-states';
import { StopEditor } from '@/components/map/stop-editor';
import { StayPanel } from '@/components/map/stay-panel';
import TripMap from '@/components/map/trip-map';
import { RoadRoutingStatus, useRoadRoutes } from '@/components/map/road-routing';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { apiErrorInfo, errorStatus, formatDate, formatRange } from '@/lib/trips';
import { usePageMeta } from '@/lib/page-meta';
import {
  buildStopInput, emptyStopValues, fmtCoord, sameValues, stopApiError, stopToValues, STOP_FIELD_ORDER, UUID_RE,
  type StopField, type StopFieldErrors, type StopFormValues,
} from '@/lib/stops';

type EditorState = { mode: 'new' | 'edit'; stopId: string | null; initial: StopFormValues; values: StopFormValues };

export default function TripMapPage({ userId }: { userId: string }) {
  const { id } = useParams<{ id?: string }>();
  const tripId = id ?? '';
  return <MapWorkspace key={tripId || 'none'} userId={userId} tripId={tripId} />;
}

function MapWorkspace({ userId, tripId }: { userId: string; tripId: string }) {
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const validTrip = !!tripId && UUID_RE.test(tripId);

  const tripsQ = useListTrips({ query: { queryKey: [...getListTripsQueryKey(), userId], retry: false, refetchOnWindowFocus: true } });
  const tripQ = useGetTrip(tripId, { query: { enabled: validTrip, queryKey: [...getGetTripQueryKey(tripId), userId], retry: false, refetchOnWindowFocus: true } });
  const stopsKey = useMemo(() => [...getListStopsQueryKey(tripId), userId], [tripId, userId]);
  const stopsQ = useListStops(tripId, { query: { enabled: validTrip, queryKey: stopsKey, retry: false, refetchOnMount: 'always', refetchOnWindowFocus: true } });

  const trip = tripQ.data;
  const stops = useMemo(() => stopsQ.data ?? [], [stopsQ.data]);
  usePageMeta(trip ? `${trip.title} map — Trip Log` : 'Map — Trip Log', 'Your trip itinerary on a map.');

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [stayDraftDirty, setStayDraftDirty] = useState(false);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [errors, setErrors] = useState<StopFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [mapPicks, setMapPicks] = useState(true);
  const [confirm, setConfirm] = useState<{ title: string; description: string; run: () => void } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Stop | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [tileError, setTileError] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);

  const create = useCreateStop();
  const update = useUpdateStop();
  const del = useDeleteStop();
  const reorder = useReorderStops();
  const busy = create.isPending || update.isPending || del.isPending || reorder.isPending;
  const roadRouting = useRoadRoutes(tripId, userId, stops, validTrip && stopsQ.isSuccess && !stopsQ.isFetching && !busy);

  const selectedValid = !!selectedId && UUID_RE.test(selectedId) && validTrip;
  const stopQ = useGetStop(tripId, selectedId ?? '', {
    query: { enabled: selectedValid, queryKey: [...getGetStopQueryKey(tripId, selectedId ?? ''), userId], retry: false, refetchOnWindowFocus: true },
  });

  const dirty = !!editor && !sameValues(editor.values, editor.initial);
  const editingMissing = editor?.mode === 'edit' && stopsQ.isSuccess && !stops.some((s) => s.id === editor.stopId);

  // Drop selection if the stop disappears (deleted elsewhere).
  useEffect(() => {
    if (selectedId && stopsQ.isSuccess && !stopsQ.isFetching && !stops.some((s) => s.id === selectedId)) {
      setStayDraftDirty(false);
      setSelectedId(null);
    }
  }, [stops, stopsQ.isSuccess, stopsQ.isFetching, selectedId]);

  // Warn before a full-page unload with unsaved changes.
  useEffect(() => {
    if (!dirty && !stayDraftDirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty, stayDraftDirty]);

  const guard = useCallback((run: () => void, title = 'Discard your unsaved stop changes?') => {
    if (busy) return;
    if (dirty || stayDraftDirty) {
      const discardStayAndRun = () => {
        setStayDraftDirty(false);
        run();
      };
      setConfirm({
        title: dirty ? title : 'Discard your unsaved accommodation changes?',
        description: dirty
          ? 'The stop editor has unsaved changes. Continuing will discard them.'
          : 'The accommodation form has unsaved changes. Continuing will discard them.',
        run: discardStayAndRun,
      });
    }
    else run();
  }, [dirty, stayDraftDirty, busy]);

  // Header/journal links also leave this workspace; don't silently drop a draft.
  useEffect(() => {
    if (!dirty && !stayDraftDirty && !busy) return;
    const intercept = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest('a[href]') as HTMLAnchorElement | null : null;
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || url.href === window.location.href) return;
      event.preventDefault(); event.stopPropagation();
      if (busy) { setNotice('Wait for the current stop change to finish before leaving.'); return; }
      const base = import.meta.env.BASE_URL.replace(/\/$/, '');
      const path = base && url.pathname.startsWith(base) ? url.pathname.slice(base.length) : url.pathname;
       setConfirm({
         title: dirty ? 'Leave without saving this stop?' : 'Leave without saving this accommodation?',
         description: dirty
           ? 'The stop editor has unsaved changes. Leaving will discard them.'
           : 'The accommodation form has unsaved changes. Leaving will discard them.',
         run: () => {
           setStayDraftDirty(false);
           setLocation((path || '/') + url.search + url.hash);
         },
       });
    };
    document.addEventListener('click', intercept, true);
    return () => document.removeEventListener('click', intercept, true);
  }, [dirty, stayDraftDirty, busy, setLocation]);

  const invalidateStops = (stopId?: string) => {
    qc.invalidateQueries({ queryKey: getListStopsQueryKey(tripId) });
    if (stopId) qc.invalidateQueries({ queryKey: getGetStopQueryKey(tripId, stopId) });
  };

  const closeEditor = () => { setEditor(null); setErrors({}); setFormError(null); };

  const openNew = (coords?: [number, number]) => {
    const values = { ...emptyStopValues, ...(coords ? { latitude: fmtCoord(coords[0]), longitude: fmtCoord(coords[1]) } : {}) };
    setEditor({ mode: 'new', stopId: null, initial: emptyStopValues, values });
    setErrors({}); setFormError(null); setMapPicks(true); setPanelOpen(true); setSelectedId(null);
    setTimeout(() => document.getElementById('stop-name')?.focus(), 50);
  };

  const openEdit = (s: Stop) => {
    const v = stopToValues(s);
    setEditor({ mode: 'edit', stopId: s.id, initial: v, values: v });
    setErrors({}); setFormError(null); setMapPicks(false); setPanelOpen(true); setSelectedId(s.id);
  };

  const selectStop = (sid: string) => {
    if (busy) return;
    if (editor && editor.stopId === sid) { setSelectedId(sid); return; }
    if (editor) guard(() => { closeEditor(); setSelectedId(sid); }, 'Leave this stop without saving?');
    else if (sid !== selectedId) guard(() => setSelectedId(sid), 'Switch stops without saving?');
  };

  const onMapClick = (lat: number, lng: number) => {
    if (!validTrip || !stopsQ.isSuccess || busy) return;
    if (editor) {
      if (!mapPicks) return;
      setEditor((e) => e && { ...e, values: { ...e.values, latitude: fmtCoord(lat), longitude: fmtCoord(lng) } });
      setErrors((er) => ({ ...er, latitude: undefined, longitude: undefined }));
      return;
    }
    guard(() => openNew([lat, lng]), 'Discard unsaved accommodation changes and add a stop?');
  };

  const onField = (f: StopField, v: string) => {
    setEditor((e) => e && { ...e, values: { ...e.values, [f]: v } });
    if (errors[f]) setErrors((er) => ({ ...er, [f]: undefined }));
  };

  const focusFirst = (fe: StopFieldErrors) => {
    const f = STOP_FIELD_ORDER.find((k) => fe[k]);
    if (f) setTimeout(() => document.getElementById(`stop-${f}`)?.focus(), 30);
  };

  const handleMutationError = (err: unknown) => {
    const info = stopApiError(err);
    setErrors(info.fields); setFormError(info.message); focusFirst(info.fields);
    if (info.conflict || info.notFound) invalidateStops();
  };

  const save = () => {
    if (!editor || busy) return;
    const built = buildStopInput(editor.values);
    if (!built.ok) { setErrors(built.fields); setFormError(Object.keys(built.fields).length ? 'Check the highlighted fields.' : built.message); focusFirst(built.fields); return; }
    setFormError(null);
    if (editor.mode === 'new') {
      create.mutate({ tripId, data: built.data }, {
        onSuccess: (s) => { invalidateStops(s.id); closeEditor(); setSelectedId(s.id); },
        onError: handleMutationError,
      });
    } else if (editor.stopId) {
      const sid = editor.stopId;
      update.mutate({ tripId, stopId: sid, data: built.data }, {
        onSuccess: (s) => { qc.setQueryData([...getGetStopQueryKey(tripId, sid), userId], s); invalidateStops(sid); closeEditor(); setSelectedId(s.id); },
        onError: handleMutationError,
      });
    }
  };

  const move = (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (busy || j < 0 || j >= stops.length) return;
    const ids = stops.map((s) => s.id);
    [ids[index], ids[j]] = [ids[j], ids[index]];
    setNotice(null);
    reorder.mutate({ tripId, data: { stopIds: ids } }, {
      onSuccess: (list) => { qc.setQueryData(stopsKey, list); invalidateStops(); },
      onError: (err) => { setNotice(stopApiError(err).message); invalidateStops(); },
    });
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    const sid = deleteTarget.id;
    setDeleteError(null);
    del.mutate({ tripId, stopId: sid }, {
      onSuccess: () => {
        qc.removeQueries({ queryKey: getGetStopQueryKey(tripId, sid) });
        invalidateStops();
        if (editor?.stopId === sid) closeEditor();
        if (selectedId === sid) {
          setStayDraftDirty(false);
          setSelectedId(null);
        }
        setDeleteTarget(null);
      },
      onError: (err) => {
        const info = stopApiError(err);
        if (info.notFound || info.conflict) { invalidateStops(); setDeleteTarget(null); setNotice(info.message); }
        else setDeleteError(info.message);
      },
    });
  };

  const changeTrip = (next: string) => {
    if (next === tripId) return;
    guard(() => setLocation(next ? `/trips/${next}/map` : '/map'), 'Switch trips without saving this stop?');
  };

  const draft = useMemo<[number, number] | null>(() => {
    if (!editor) return null;
    const la = Number(editor.values.latitude), lo = Number(editor.values.longitude);
    if (editor.values.latitude.trim() === '' || editor.values.longitude.trim() === '') return null;
    if (!Number.isFinite(la) || !Number.isFinite(lo) || Math.abs(la) > 90 || Math.abs(lo) > 180) return null;
    if (editor.mode === 'edit' && editor.values.latitude === editor.initial.latitude && editor.values.longitude === editor.initial.longitude) return null;
    return [la, lo];
  }, [editor]);

  const trips = tripsQ.data;
  const selectedStop = stops.find((s) => s.id === selectedId) ?? null;
  const selectedDetail = stopQ.data && stopQ.data.id === selectedId ? stopQ.data : selectedStop;
  const selectedIndex = selectedStop ? stops.indexOf(selectedStop) : -1;

  // Header + selector
  const selector = (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor="trip-select" className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Trip</label>
      {tripsQ.isLoading ? <div className="h-10 w-64 animate-pulse rounded-xl bg-muted" /> : (
        <select id="trip-select" value={validTrip ? tripId : ''} onChange={(e) => changeTrip(e.target.value)} disabled={busy || !trips}
          className="h-10 w-full max-w-xs rounded-xl border border-input bg-card px-3 text-sm font-medium outline-none focus:border-ring focus:ring-[3px] focus:ring-ring/15 sm:w-72" data-testid="select-trip">
          <option value="">{trips && trips.length === 0 ? 'No trips yet' : 'Choose a trip…'}</option>
          {trips?.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
        </select>
      )}
    </div>
  );

  let tripGate: ReactNode = null;
  if (tripId && !validTrip) tripGate = <TripNotFound />;
  else if (validTrip && tripQ.isError && errorStatus(tripQ.error) === 404) tripGate = <TripNotFound />;
  else if (validTrip && tripQ.isError) tripGate = <ErrorPanel title="This trip didn't load" message={apiErrorInfo(tripQ.error).message.replace('saving', 'loading')} onRetry={() => tripQ.refetch()} retrying={tripQ.isFetching} />;

  if (tripGate) {
    return <AppShell width="max-w-[1400px]">{tripGate}</AppShell>;
  }

  let panelBody: ReactNode;
  if (!validTrip) {
    panelBody = tripsQ.isError ? (
      <ErrorPanel title="Your trips didn't load" message={apiErrorInfo(tripsQ.error).message.replace('saving', 'loading')} onRetry={() => tripsQ.refetch()} retrying={tripsQ.isFetching} />
    ) : trips && trips.length === 0 ? (
      <div className="rounded-2xl border border-dashed border-border bg-card/60 p-6" data-testid="status-no-trips">
        <h2 className="font-display text-2xl">Nothing to map yet</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Log a trip first, then come back to pin where it took you.</p>
        <Link href="/trips/new" className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground" data-testid="link-new-trip-map"><Plus className="h-4 w-4" /> New trip</Link>
      </div>
    ) : (
      <div className="rounded-2xl border border-dashed border-border bg-card/60 p-6" data-testid="status-choose-trip">
        <MapPinned className="h-6 w-6 text-primary" />
        <h2 className="font-display mt-3 text-2xl">Pick a journey</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Choose a trip above to open its itinerary. Stops appear on the map in the order you travelled them.</p>
      </div>
    );
  } else if (stopsQ.isLoading) {
    panelBody = (
      <ul className="space-y-2" aria-busy="true" aria-label="Loading stops" data-testid="status-loading-stops">
        {[0, 1, 2].map((i) => <li key={i} className="flex items-center gap-3 rounded-xl p-3"><div className="h-8 w-8 animate-pulse rounded-full bg-muted" /><div className="flex-1 space-y-2"><div className="h-4 w-2/3 animate-pulse rounded bg-muted" /><div className="h-3 w-1/3 animate-pulse rounded bg-muted" /></div></li>)}
      </ul>
    );
  } else if (stopsQ.isError) {
    panelBody = <ErrorPanel title="The itinerary didn't load" message={stopApiError(stopsQ.error).message} onRetry={() => stopsQ.refetch()} retrying={stopsQ.isFetching} />;
  } else {
    panelBody = (
      <div className="space-y-4">
        {notice && (
          <div role="alert" className="flex items-start gap-2 rounded-xl border border-[hsl(36_60%_70%)] bg-[hsl(40_80%_94%)] p-3 text-sm text-[hsl(30_50%_25%)]" data-testid="text-stop-notice">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /><span className="flex-1">{notice}</span>
            <button type="button" onClick={() => setNotice(null)} className="text-xs font-medium underline" data-testid="button-dismiss-notice">Dismiss</button>
          </div>
        )}
        {editor && (
          <>
            {editingMissing && <p role="alert" className="rounded-xl bg-destructive/5 p-3 text-sm text-destructive" data-testid="text-editing-missing">This stop was removed in another session. Your typed values are kept, but saving will fail. Cancel, or copy what you need.</p>}
            <StopEditor mode={editor.mode} position={editor.mode === 'edit' ? stops.findIndex((s) => s.id === editor.stopId) + 1 : stops.length + 1}
              values={editor.values} errors={errors} formError={formError} saving={create.isPending || update.isPending} dirty={dirty}
              mapPicks={mapPicks} onMapPicksChange={setMapPicks} onChange={onField} onSubmit={save}
              onCancel={() => guard(closeEditor)} />
          </>
        )}
        {stops.length === 0 && !editor ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/60 p-6" data-testid="status-empty-stops">
            <h2 className="font-display text-2xl">No stops yet</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Click anywhere on the map to drop the first pin, or add one with typed coordinates.</p>
            <button type="button" onClick={() => openNew()} className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground" data-testid="button-new-stop-empty"><Plus className="h-4 w-4" /> Add a stop</button>
          </div>
        ) : stops.length > 0 && (
          <ol className="space-y-1" data-testid="list-stops">
            {stops.map((s, i) => {
              const active = s.id === selectedId;
              const isEditing = editor?.stopId === s.id;
              return (
                <li key={s.id} data-testid={`row-stop-${s.id}`}>
                  {i > 0 && s.transportFromPrevious && <p className="ml-[1.6rem] border-l border-dashed border-border py-1 pl-4 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">by {s.transportFromPrevious.toLowerCase()}</p>}
                  <div className={`group flex items-center gap-2 rounded-xl p-2 transition-colors ${active ? 'bg-accent' : 'hover:bg-card'}`}>
                    <button type="button" onClick={() => selectStop(s.id)} aria-pressed={active} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid={`button-select-stop-${s.id}`}>
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold tabular-nums ${active ? 'border-primary bg-primary text-primary-foreground' : 'border-primary/70 bg-card text-primary'}`}>{i + 1}</span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium" data-testid={`text-stop-name-${s.id}`}>{s.name}{isEditing && <span className="ml-2 text-xs font-normal text-primary">editing</span>}</span>
                        <span className="block truncate text-xs text-muted-foreground">{[s.visitDate ? formatDate(s.visitDate) : null, s.stopType].filter(Boolean).join(' · ') || `${fmtCoord(s.latitude)}, ${fmtCoord(s.longitude)}`}</span>
                         {s.stay && <span className="mt-1 flex flex-wrap items-center gap-1 text-[11px] font-medium text-primary" data-testid={`text-stop-stay-${s.id}`}><BedDouble className="h-3 w-3" aria-hidden="true" />{s.stay.accommodationType} · {formatDate(s.stay.checkIn)} – {formatDate(s.stay.checkOut)}</span>}
                      </span>
                    </button>
                    <div className="flex shrink-0 items-center">
                      <IconBtn label={`Move ${s.name} up`} onClick={() => move(i, -1)} disabled={busy || i === 0} testId={`button-move-up-${s.id}`}><ArrowUp className="h-4 w-4" /></IconBtn>
                      <IconBtn label={`Move ${s.name} down`} onClick={() => move(i, 1)} disabled={busy || i === stops.length - 1} testId={`button-move-down-${s.id}`}><ArrowDown className="h-4 w-4" /></IconBtn>
                      <IconBtn label={`Edit ${s.name}`} onClick={() => (isEditing ? undefined : guard(() => openEdit(s)))} disabled={busy || isEditing} testId={`button-edit-stop-${s.id}`}><Pencil className="h-4 w-4" /></IconBtn>
                      <IconBtn label={`Delete ${s.name}`} onClick={() => { setDeleteError(null); setDeleteTarget(s); }} disabled={busy} testId={`button-delete-stop-${s.id}`} danger><Trash2 className="h-4 w-4" /></IconBtn>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
        {selectedDetail && !editor && (
          <section className="rise rounded-2xl border border-card-border bg-card p-4" aria-label="Selected stop" data-testid="panel-stop-detail">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Stop {selectedIndex + 1}{selectedDetail.stopType ? ` · ${selectedDetail.stopType}` : ''}</p>
            <h3 className="font-display mt-1 break-words text-xl" data-testid="text-selected-stop-name">{selectedDetail.name}</h3>
            <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
              {selectedDetail.visitDate && <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{formatDate(selectedDetail.visitDate, true)}</span>}
              <span className="font-mono">{fmtCoord(selectedDetail.latitude)}, {fmtCoord(selectedDetail.longitude)}</span>
            </p>
            {selectedDetail.notes ? <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed" data-testid="text-selected-stop-notes">{selectedDetail.notes}</p> : <p className="mt-3 text-sm italic text-muted-foreground">No notes for this stop.</p>}
            <StayPanel key={selectedDetail.id} stop={selectedDetail} onDirtyChange={setStayDraftDirty} />
            {stopQ.isError && errorStatus(stopQ.error) !== 404 && <p className="mt-2 text-xs text-muted-foreground">Latest details couldn't refresh; showing the itinerary copy.</p>}
            <button type="button" onClick={() => guard(() => openEdit(selectedDetail))} disabled={busy} className="mt-4 inline-flex items-center gap-2 rounded-full border border-border px-3.5 py-1.5 text-sm font-medium hover:bg-muted disabled:opacity-50" data-testid="button-edit-selected-stop"><Pencil className="h-3.5 w-3.5" /> Edit stop</button>
          </section>
        )}
      </div>
    );
  }

  const canAdd = validTrip && stopsQ.isSuccess;

  return (
    <AppShell width="max-w-[1400px]">
      <div className="-mt-2 flex flex-wrap items-end justify-between gap-4 md:-mt-6">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Map</p>
          <h1 className="font-display mt-1 break-words text-3xl md:text-4xl" data-testid="text-map-title">{trip ? trip.title : validTrip ? <span className="inline-block h-9 w-56 animate-pulse rounded-lg bg-muted align-middle" /> : 'Where you went'}</h1>
          {trip && <p className="mt-1 text-sm text-muted-foreground">{formatRange(trip.startDate, trip.endDate)}{trip.destinationRegion ? ` · ${trip.destinationRegion}` : ''}</p>}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          {selector}
          {trip && <Link href={`/trips/${trip.id}`} className="inline-flex h-10 items-center gap-2 rounded-full border border-border px-4 text-sm font-medium hover:bg-card" data-testid="link-trip-journal"><BookOpen className="h-4 w-4" /> Journal entry</Link>}
        </div>
      </div>

      <div className={`mt-6 grid gap-4 ${panelOpen ? 'lg:grid-cols-[minmax(0,1fr)_420px]' : ''}`}>
        <div className={`trip-map relative overflow-hidden rounded-[1.5rem] border border-card-border bg-muted ${panelOpen ? 'h-[52dvh]' : 'h-[72dvh]'} min-h-[300px] lg:h-[calc(100dvh-15rem)] lg:min-h-[480px]`}>
          <TripMap tripKey={tripId} stops={stops} selectedId={selectedId} draft={draft} roadRoutes={roadRouting.data}
            onSelect={selectStop} onMapClick={onMapClick} onTileError={() => setTileError(true)} onTileLoad={() => tileError && setTileError(false)} />
          <div className="pointer-events-none absolute inset-x-3 top-3 z-[1000] flex flex-col items-end gap-2">
            {tileError && <p role="status" className="pointer-events-auto max-w-sm rounded-xl border border-destructive/30 bg-card/95 px-3 py-2 text-xs text-destructive shadow-sm" data-testid="status-tile-error">Some map tiles didn't load. Your stops are safe; check your connection, then pan or zoom to retry.</p>}
            {validTrip && stopsQ.isFetching && !stopsQ.isLoading && <p className="rounded-full bg-card/90 px-3 py-1 text-xs text-muted-foreground"><Loader2 className="mr-1 inline h-3 w-3 animate-spin" />Syncing</p>}
          </div>
          <div className="pointer-events-none absolute inset-x-3 bottom-8 z-[1000] flex justify-center">
            <p className="pointer-events-auto rounded-full bg-card/95 px-3.5 py-1.5 text-center text-xs font-medium shadow-sm" data-testid="text-map-hint">
              {!validTrip ? 'Choose a trip to see its stops'
                : !canAdd ? 'Loading itinerary…'
                  : editor ? (mapPicks ? 'Click the map to set this stop\u2019s location' : 'Map clicks are off while editing')
                    : 'Click the map to start a new stop there'}
            </p>
          </div>
          {validTrip && stopsQ.isLoading && <div className="absolute inset-0 z-[900] animate-pulse bg-muted/50" aria-hidden="true" />}
          {!panelOpen && (
            <button type="button" onClick={() => setPanelOpen(true)} className="absolute right-3 top-14 z-[1000] hidden items-center gap-2 rounded-full bg-card px-3.5 py-2 text-sm font-medium shadow-sm lg:inline-flex" data-testid="button-show-itinerary"><PanelRightOpen className="h-4 w-4" /> Itinerary</button>
          )}
        </div>

        <aside className={`min-w-0 ${panelOpen ? '' : 'lg:hidden'}`} aria-label="Itinerary">
          <div className="flex items-center justify-between gap-2 rounded-2xl border border-card-border bg-card/70 px-3 py-2 lg:border-0 lg:bg-transparent lg:px-0">
            <button type="button" onClick={() => panelOpen ? guard(() => setPanelOpen(false)) : setPanelOpen(true)} aria-expanded={panelOpen} aria-controls="itinerary-body" className="inline-flex items-center gap-2 text-sm font-semibold" data-testid="button-toggle-itinerary">
              <span className="lg:hidden">{panelOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</span>
              <span className="hidden lg:inline"><PanelRightClose className="h-4 w-4" /></span>
              Itinerary{validTrip && stopsQ.isSuccess ? ` · ${stops.length} ${stops.length === 1 ? 'stop' : 'stops'}` : ''}
            </button>
            <button type="button" onClick={() => guard(() => openNew())} disabled={!canAdd || busy || editor?.mode === 'new'} className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50" data-testid="button-new-stop">
              <Plus className="h-4 w-4" /> New stop
            </button>
          </div>
          {panelOpen && <div id="itinerary-body" className="mt-3 lg:max-h-[calc(100dvh-18rem)] lg:overflow-y-auto lg:pr-1">{panelBody}</div>}
        </aside>
      </div>
      {validTrip && <RoadRoutingStatus routing={roadRouting} />}

      <AlertDialog open={!!confirm} onOpenChange={(o) => { if (!o) setConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">{confirm?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirm?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-keep-editing">Keep editing</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { const r = confirm?.run; setConfirm(null); if (dirty) closeEditor(); r?.(); }} data-testid="button-confirm-discard">Discard changes</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o && !del.isPending) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Delete this stop?</AlertDialogTitle>
            <AlertDialogDescription>"{deleteTarget?.name}" will be removed from the itinerary, any accommodation attached to it will also be deleted, and the stops after it move up. This can't be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && <p role="alert" className="text-sm text-destructive" data-testid="text-delete-stop-error">{deleteError}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={del.isPending} data-testid="button-cancel-delete-stop">Keep stop</AlertDialogCancel>
            <button type="button" onClick={confirmDelete} disabled={del.isPending} className="inline-flex items-center justify-center gap-2 rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-60" data-testid="button-confirm-delete-stop">
              {del.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Delete stop
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

function IconBtn({ label, onClick, disabled, testId, danger, children }: { label: string; onClick: () => void; disabled?: boolean; testId: string; danger?: boolean; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled}
      className={`rounded-full p-1.5 text-muted-foreground transition-colors disabled:pointer-events-none disabled:opacity-30 ${danger ? 'hover:bg-destructive/10 hover:text-destructive' : 'hover:bg-muted hover:text-foreground'}`} data-testid={testId}>
      {children}
    </button>
  );
}
