import { Link } from 'wouter';
import { ArrowUpRight } from 'lucide-react';
import type { Trip } from '@workspace/api-client-react';
import { formatRange, startParts, tripDays } from '@/lib/trips';

export function TripRow({ trip, index }: { trip: Trip; index: number }) {
  const s = startParts(trip.startDate);
  const days = tripDays(trip.startDate, trip.endDate);
  return (
    <li className="rise" style={{ animationDelay: `${Math.min(index, 8) * 50}ms` }}>
      <Link href={`/trips/${trip.id}`} className="group grid grid-cols-[3.5rem_1fr_auto] items-center gap-4 rounded-2xl px-3 py-4 transition-colors hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:grid-cols-[4.5rem_1fr_auto] md:gap-6 md:px-5" data-testid={`card-trip-${trip.id}`}>
        <div className="text-center leading-none">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">{s.month}</p>
          <p className="font-display mt-1 text-3xl">{s.day}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">{s.year}</p>
        </div>
        <div className="min-w-0 border-l border-dashed border-border pl-4 md:pl-6">
          <p className="font-display truncate text-xl md:text-2xl" data-testid={`text-trip-title-${trip.id}`}>{trip.title}</p>
          <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span>{formatRange(trip.startDate, trip.endDate)}</span>
            {days !== null && <span>{days} {days === 1 ? 'day' : 'days'}</span>}
            {trip.destinationRegion && <span className="truncate">{trip.destinationRegion}</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {trip.tripType && <span className="hidden rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground sm:inline">{trip.tripType}</span>}
          <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
        </div>
      </Link>
    </li>
  );
}
