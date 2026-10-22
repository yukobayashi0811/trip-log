import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Loader2, RotateCw, Star } from 'lucide-react';
import {
  getGetStarredTripsQueryKey,
  useStarTrip,
  useUnstarTrip,
} from '@workspace/api-client-react';

export function TripStarButton({
  tripId,
  userId,
  isStarred,
  loading = false,
  error: statusError = false,
  onRetry,
  compact = false,
}: {
  tripId: string;
  userId: string;
  isStarred: boolean | undefined;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  compact?: boolean;
}) {
  const qc = useQueryClient();
  const star = useStarTrip();
  const unstar = useUnstarTrip();
  const [mutationError, setMutationError] = useState(false);
  const pending = star.isPending || unstar.isPending;
  const disabled = pending || loading || statusError || isStarred === undefined;
  const label = statusError
    ? 'Star status unavailable'
    : loading && isStarred === undefined
      ? 'Loading star status'
      : isStarred
        ? 'Remove star'
        : 'Star trip';

  const toggle = () => {
    if (disabled) return;
    setMutationError(false);
    const mutation = isStarred ? unstar : star;
    mutation.mutate({ tripId }, {
      onSuccess: async () => {
        await qc.invalidateQueries({
          queryKey: [...getGetStarredTripsQueryKey(), userId],
        });
      },
      onError: () => setMutationError(true),
    });
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={disabled}
        aria-label={label}
        aria-pressed={isStarred}
        title={label}
        data-testid={`button-star-trip-${tripId}`}
        className={`inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full border px-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 ${isStarred ? 'border-primary/30 bg-accent text-primary hover:bg-accent/70' : 'border-border text-muted-foreground hover:bg-card hover:text-primary'} ${compact ? 'px-2.5' : 'px-3'}`}
      >
        {statusError
          ? <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          : pending || (loading && isStarred === undefined)
            ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            : <Star className={`h-4 w-4 ${isStarred ? 'fill-current' : ''}`} aria-hidden="true" />}
        {!compact && <span className="text-sm font-medium">{statusError ? 'Unavailable' : isStarred ? 'Starred' : 'Star'}</span>}
      </button>
      {statusError && onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1 text-xs text-destructive underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          data-testid={`button-retry-star-status-${tripId}`}
        >
          <RotateCw className="h-3 w-3" aria-hidden="true" /> Retry status
        </button>
      )}
      {mutationError && (
        <span role="alert" className="max-w-36 text-center text-xs text-destructive" data-testid={`error-star-trip-${tripId}`}>
          Star wasn't changed. Try again.
        </span>
      )}
    </div>
  );
}
