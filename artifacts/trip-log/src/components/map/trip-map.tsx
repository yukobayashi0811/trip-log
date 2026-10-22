import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import type { Stop, TripRouting } from '@workspace/api-client-react';
import RoadLines from './road-lines';
import { formatDate } from '@/lib/trips';

function pinIcon(n: number | string, selected: boolean, draft = false) {
  // Content is only a number or a fixed symbol; never user text.
  const label = typeof n === 'number' ? String(Math.trunc(n)) : '+';
  return L.divIcon({
    className: 'stop-pin-wrap',
    html: `<span class="stop-pin${selected ? ' is-selected' : ''}${draft ? ' is-draft' : ''}"><b>${label}</b></span>`,
    iconSize: [34, 34],
    iconAnchor: [17, 34],
    popupAnchor: [0, -32],
  });
}

function FitBounds({ signature, points }: { signature: string; points: [number, number][] }) {
  const map = useMap();
  const pointsRef = useRef(points);
  pointsRef.current = points;
  useEffect(() => {
    const pts = pointsRef.current;
    if (pts.length === 0) return;
    if (pts.length === 1) map.setView(pts[0], Math.max(map.getZoom(), 9));
    else map.fitBounds(L.latLngBounds(pts), { padding: [48, 48], maxZoom: 12 });
  }, [signature, map]);
  return null;
}

function FocusSelected({ target }: { target: [number, number] | null }) {
  const map = useMap();
  const key = target ? `${target[0]},${target[1]}` : '';
  const targetRef = useRef(target);
  targetRef.current = target;
  useEffect(() => {
    const t = targetRef.current;
    if (t && !map.getBounds().pad(-0.1).contains(t)) map.panTo(t);
  }, [key, map]);
  return null;
}

function AutoResize() {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(el);
    return () => ro.disconnect();
  }, [map]);
  return null;
}

function ClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  const ref = useRef(onClick);
  ref.current = onClick;
  useMapEvents({ click: (e) => ref.current(e.latlng.lat, L.Util.wrapNum(e.latlng.lng, [-180, 180], true)) });
  return null;
}

export type TripMapProps = {
  roadRoutes?: TripRouting;
  tripKey: string;
  stops: Stop[];
  selectedId: string | null;
  draft: [number, number] | null;
  onSelect: (id: string) => void;
  onMapClick: (lat: number, lng: number) => void;
  onTileError: () => void;
  onTileLoad: () => void;
};

function StopPin({ stop, number, selected, onSelect }: {
  stop: Stop; number: number; selected: boolean; onSelect: (id: string) => void;
}) {
  const marker = useRef<L.Marker>(null);
  // Itinerary selection and popup selection are the same state. Closing an old
  // popup must not depend on the user clicking another physical marker.
  useEffect(() => {
    if (selected) marker.current?.openPopup();
    else marker.current?.closePopup();
  }, [selected]);
  return (
    <Marker ref={marker} position={[stop.latitude, stop.longitude]} icon={pinIcon(number, selected)}
      zIndexOffset={selected ? 1000 : 0} title={`Stop ${number}: ${stop.name}`} alt={`Stop ${number}`}
      eventHandlers={{ click: () => onSelect(stop.id) }}>
      <Popup>
        <div className="stop-popup">
          <p className="stop-popup-n">Stop {number}{stop.stopType ? ` · ${stop.stopType}` : ''}</p>
          <p className="stop-popup-name">{stop.name}</p>
          {stop.visitDate && <p className="stop-popup-meta">{formatDate(stop.visitDate, true)}</p>}
          {stop.transportFromPrevious && number > 1 && <p className="stop-popup-meta">Arrived by {stop.transportFromPrevious.toLowerCase()}</p>}
        </div>
      </Popup>
    </Marker>
  );
}

export default function TripMap({ tripKey, stops, selectedId, draft, onSelect, onMapClick, onTileError, onTileLoad, roadRoutes }: TripMapProps) {
  const points = useMemo(() => stops.map((s) => [s.latitude, s.longitude] as [number, number]), [stops]);
  const signature = `${tripKey}|${points.map((p) => p.join(',')).join(';')}`;
  const selected = stops.find((s) => s.id === selectedId) ?? null;
  const tileErrRef = useRef(onTileError); tileErrRef.current = onTileError;
  const tileLoadRef = useRef(onTileLoad); tileLoadRef.current = onTileLoad;
  const tileHandlers = useMemo(() => ({ tileerror: () => tileErrRef.current(), tileload: () => tileLoadRef.current() }), []);

  return (
    <MapContainer center={[39.5, -98.35]} zoom={3} minZoom={2} worldCopyJump className="h-full w-full" data-testid="map-container">
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'
        eventHandlers={tileHandlers}
      />
      <AutoResize />
      <FitBounds signature={signature} points={points} />
      <FocusSelected target={selected ? [selected.latitude, selected.longitude] : null} />
      <ClickHandler onClick={onMapClick} />
      {roadRoutes && <RoadLines routing={roadRoutes} stops={stops} />}
      {stops.map((s, i) => <StopPin key={s.id} stop={s} number={i + 1} selected={s.id === selectedId} onSelect={onSelect} />)}
      {draft && <Marker position={draft} icon={pinIcon('+', true, true)} interactive={false} />}
    </MapContainer>
  );
}
