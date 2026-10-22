import type { Stop } from "./generated/types/stop";

export type RoutingStop = Pick<Stop, "id" | "sortOrder" | "latitude" | "longitude" | "transportFromPrevious">;
export const orderedRoutingStops = (stops: readonly RoutingStop[]) =>
  [...stops].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));

// The shared revision excludes names/notes/dates: these do not change roads.
export const routingRevision = (stops: readonly RoutingStop[]) => JSON.stringify(
  orderedRoutingStops(stops).map(s => [s.id, s.longitude, s.latitude, s.transportFromPrevious ?? null]),
);

export function drivingSections(stops: readonly RoutingStop[]): RoutingStop[][] {
  const rows = orderedRoutingStops(stops);
  const runs: RoutingStop[][] = [];
  let run: RoutingStop[] = [];
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].transportFromPrevious === "Driving") {
      if (!run.length) run.push(rows[i - 1]);
      run.push(rows[i]);
    } else if (run.length) { runs.push(run); run = []; }
  }
  if (run.length) runs.push(run);
  // Provider maximum is 50 waypoints; overlap boundaries, never skip a leg
  // or impose an artificial limit on the number of saved stops.
  return runs.flatMap(items => {
    const chunks: RoutingStop[][] = [];
    for (let i = 0; i < items.length - 1; i += 49) chunks.push(items.slice(i, i + 50));
    return chunks;
  });
}
