export type TripSearchRecord = {
  id: string;
  title: string;
  startDate: string;
  destinationRegion?: string | null;
};

export type TripSearchFilters = {
  query: string;
  region: string;
  year: string;
  starredOnly: boolean;
  sortOrder: 'newest' | 'oldest';
};

const compareText = (left: string, right: string) =>
  left < right ? -1 : left > right ? 1 : 0;

function regionCaseRank(value: string): number {
  const titleCase = value.replace(/\S+/g, (word) => word[0].toUpperCase() + word.slice(1).toLowerCase());
  if (value === titleCase) return 0;
  if (value === value.toUpperCase()) return 1;
  return 2;
}

function dateOnlyYear(date: string): string | null {
  const match = /^(\d{4})-\d{2}-\d{2}$/.exec(date);
  return match?.[1] ?? null;
}

function normalizedRegion(region: string | null | undefined): string {
  return region?.trim().toLowerCase() ?? '';
}

export function tripRegionOptions<T extends TripSearchRecord>(trips: readonly T[]): string[] {
  const unique = new Map<string, string>();
  for (const trip of trips) {
    const value = trip.destinationRegion?.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    const current = unique.get(key);
    if (
      current === undefined ||
      regionCaseRank(value) < regionCaseRank(current) ||
      (regionCaseRank(value) === regionCaseRank(current) && compareText(value, current) < 0)
    ) {
      unique.set(key, value);
    }
  }
  return [...unique.values()].sort((a, b) =>
    compareText(a.toLowerCase(), b.toLowerCase()) || compareText(a, b),
  );
}

export function tripYearOptions<T extends TripSearchRecord>(trips: readonly T[]): string[] {
  return [...new Set(trips.map((trip) => dateOnlyYear(trip.startDate)).filter(
    (year): year is string => year !== null,
  ))].sort((a, b) => compareText(b, a));
}

export function filterAndSortTrips<T extends TripSearchRecord>(
  trips: readonly T[],
  starredTripIds: ReadonlySet<string>,
  filters: TripSearchFilters,
): T[] {
  const query = filters.query.trim().toLowerCase();
  const region = normalizedRegion(filters.region);
  const direction = filters.sortOrder === 'oldest' ? 1 : -1;

  return trips
    .filter((trip) => !query || trip.title.toLowerCase().includes(query))
    .filter((trip) => !region || normalizedRegion(trip.destinationRegion) === region)
    .filter((trip) => !filters.year || dateOnlyYear(trip.startDate) === filters.year)
    .filter((trip) => !filters.starredOnly || starredTripIds.has(trip.id))
    .slice()
    .sort((a, b) => direction * compareText(a.startDate, b.startDate) || compareText(a.id, b.id));
}
