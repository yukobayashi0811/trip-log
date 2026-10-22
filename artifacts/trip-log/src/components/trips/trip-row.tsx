import { Link } from 'wouter';
import { ArrowUpRight } from 'lucide-react';
import type { Trip } from '@workspace/api-client-react';
import { formatRange, startParts, tripDays } from '@/lib/trips';
import { TripStarButton } from '@/components/trips/trip-star-button';

export function TripRow({ trip, index, userId, isStarred }: { trip: Trip; index: number; userId: string; isStarred: boolean }) {
  const s = startParts(trip.startDate);
  const days = tripDays(trip.startDate, trip.endDate);
  return (
    <li className="rise" style={{ animationDelay: `${Math.min(index, 8) * 50}ms` }}>
      <div className="grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-2 rounded-2xl px-2 py-3 transition-colors hover:bg-card sm:grid-cols-[4.5rem_minmax(0,1fr)_auto_auto] sm:gap-4 sm:px-3 md:gap-6 md:px-5">
        <Link href={`/trips/${trip.id}`} className="group col-span-2 grid min-w-0 grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:col-span-3 sm:grid-cols-[4.5rem_minmax(0,1fr)_auto] sm:gap-4 md:gap-6" data-testid={`card-trip-${trip.id}`}>
          <div className="text-center leading-none">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">{s.month}</p>
            <p className="font-display mt-1 text-3xl">{s.day}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{s.year}</p>
          </div>
          <div className="min-w-0 border-l border-dashed border-border pl-3 sm:pl-4 md:pl-6">
            <p className="font-display truncate text-xl md:text-2xl" data-testid={`text-trip-title-${trip.id}`}>{trip.title}</p>
            <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span>{formatRange(trip.startDate, trip.endDate)}</span>
              {days !== null && <span>{days} {days === 1 ? 'day' : 'days'}</span>}
              {trip.destinationRegion && <span className="truncate">{trip.destinationRegion}</span>}
            </p>
          </div>
          <div className="hidden items-center gap-3 sm:flex">
            {trip.tripType && <span className="hidden rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground md:inline">{trip.tripType}</span>}
            <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
          </div>
        </Link>
        <div className="justify-self-end">
          <TripStarButton tripId={trip.id} userId={userId} isStarred={isStarred} compact />
        </div>
      </div>
    </li>
  );
}
