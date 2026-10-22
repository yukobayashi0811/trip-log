import type { ReactNode } from 'react';
import { Link } from 'wouter';
import { AlertTriangle, RotateCw } from 'lucide-react';

export function ErrorPanel({ title, message, onRetry, retrying, extra }: { title: string; message: string; onRetry?: () => void; retrying?: boolean; extra?: ReactNode }) {
  return (
    <div role="alert" className="rise rounded-2xl border border-destructive/25 bg-destructive/[0.04] p-6 md:p-8" data-testid="status-error">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10"><AlertTriangle className="h-5 w-5 text-destructive" /></div>
        <div>
          <p className="font-display text-xl">{title}</p>
          <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-muted-foreground">{message}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            {onRetry && (
              <button type="button" onClick={onRetry} disabled={retrying} className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60" data-testid="button-retry">
                <RotateCw className={`h-4 w-4 ${retrying ? 'animate-spin' : ''}`} /> {retrying ? 'Retrying…' : 'Retry'}
              </button>
            )}
            {extra}
          </div>
        </div>
      </div>
    </div>
  );
}

export function TripNotFound() {
  return (
    <div className="rise mx-auto max-w-lg py-16 text-center" data-testid="status-not-found">
      <svg viewBox="0 0 200 80" className="mx-auto w-48" aria-hidden="true">
        <path d="M10 60 C 50 20, 90 70, 130 35" fill="none" stroke="hsl(174 42% 30%)" strokeWidth="2.5" strokeDasharray="2 8" strokeLinecap="round" />
        <circle cx="10" cy="60" r="5" fill="hsl(42 45% 98%)" stroke="hsl(174 42% 28%)" strokeWidth="2.5" />
        <path d="M150 28 l14 14 M164 28 l-14 14" stroke="hsl(6 58% 44%)" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      <h1 className="font-display mt-6 text-3xl">This trail goes cold</h1>
      <p className="mt-3 text-muted-foreground">This trip isn't in your journal. It may have been deleted, or the link belongs to someone else's journal.</p>
      <Link href="/trips" className="mt-7 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground" data-testid="link-back-trips">Back to all trips</Link>
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading trip" data-testid="status-loading">
      <div className="h-4 w-28 animate-pulse rounded bg-muted" />
      <div className="h-11 w-3/4 animate-pulse rounded-lg bg-muted" />
      <div className="h-5 w-56 animate-pulse rounded bg-muted" />
      <div className="h-48 w-full animate-pulse rounded-2xl bg-muted" />
    </div>
  );
}
