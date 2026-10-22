import { useEffect, useMemo } from 'react';
import { Polyline, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { Stop, TripRouting } from '@workspace/api-client-react';

export default function RoadLines({ routing, stops }: { routing: TripRouting; stops: Stop[] }) {
  const map = useMap();
  // GeoJSON is [longitude,latitude]; Leaflet positions are [latitude,longitude].
  const lines = useMemo(() => routing.segments.filter(s => s.status === 'ready' && s.coordinates.length >= 2)
    .map(s => ({ id: s.stopIds.join('/'), points: s.coordinates.map(p => [p[1], p[0]] as [number, number]) })), [routing]);
  const markerPoints = useMemo(() => stops.map(s => [s.latitude, s.longitude] as [number, number]), [stops]);
  useEffect(() => {
    const points = [...markerPoints, ...lines.flatMap(line => line.points)];
    if (lines.length && points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom: 12 });
  }, [lines, markerPoints, map]);
  return <>{lines.map(line => <Polyline key={line.id} positions={line.points} className="estimated-driving-route"
    eventHandlers={{ add: event => {
      const element = (event.target as L.Polyline).getElement();
      element?.setAttribute('aria-label', 'Estimated Driving Route');
      element?.setAttribute('role', 'img');
    } }}
    pathOptions={{ color: '#277267', weight: 4, opacity: 0.85 }} bubblingMouseEvents>
    <Tooltip>Estimated Driving Route</Tooltip>
  </Polyline>)}</>;
}
