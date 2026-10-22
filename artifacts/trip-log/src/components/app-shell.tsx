import { useState, type ReactNode } from 'react';
import { useClerk } from '@clerk/react';
import { Link, useLocation } from 'wouter';
import { BookOpen, Loader2, Map as MapIcon, LogOut, UserRound } from 'lucide-react';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

function NavLink({ href, active, icon, label, testId }: { href: string; active: boolean; icon: ReactNode; label: string; testId: string }) {
  return (
    <Link href={href} aria-label={label} title={label} aria-current={active ? 'page' : undefined} data-testid={testId}
      className={`inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active ? 'bg-accent text-accent-foreground' : 'text-foreground/70 hover:bg-card hover:text-foreground'}`}>
      {icon}<span className="hidden sm:inline">{label}</span>
    </Link>
  );
}

export function LogoutButton({ compact = false }: { compact?: boolean }) {
  const { signOut } = useClerk();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handle = async () => {
    setPending(true);
    setError(null);
    try {
      await signOut({ redirectUrl: basePath || '/' });
    } catch {
      setError("We couldn't log you out. Check your connection and try again.");
      setPending(false);
    }
  };
  return (
    <div className="relative flex flex-col items-end">
      <button type="button" onClick={handle} disabled={pending} aria-label="Log out" className="inline-flex items-center gap-2 rounded-full border border-border px-3.5 py-2 text-sm font-medium transition-colors hover:bg-card disabled:opacity-60" data-testid="button-logout">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
        <span className={compact ? 'hidden sm:inline' : ''}>{pending ? 'Logging out…' : 'Log out'}</span>
      </button>
      {error && <p role="alert" className="absolute right-0 top-full mt-2 w-64 rounded-lg border border-destructive/30 bg-card p-2 text-right text-xs text-destructive" data-testid="text-logout-error">{error}</p>}
    </div>
  );
}

export function AppShell({ children, width = 'max-w-5xl' }: { children: ReactNode; width?: string }) {
  const [location] = useLocation();
  const onMap = location === '/map' || /^\/trips\/[^/]+\/map$/.test(location);
  const onTrips = !onMap && (location === '/trips' || location.startsWith('/trips/'));
  return (
    <div className="paper-grain min-h-[100dvh]">
      <header className="relative z-20 border-b border-border/70 bg-background/80 backdrop-blur">
        <div className={`mx-auto flex ${width} items-center justify-between gap-3 px-5 py-4 md:px-8`}>
          <Link href="/trips" className="flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid="link-home">
            <img src={`${basePath}/logo.svg`} alt="" className="h-8 w-8" />
            <span className="font-display hidden text-xl font-semibold sm:inline">Trip Log</span>
          </Link>
          <nav aria-label="Main" className="flex items-center gap-1 sm:gap-2">
            <NavLink href="/trips" active={onTrips} icon={<BookOpen className="h-4 w-4" />} label="All Trips" testId="link-nav-trips" />
            <NavLink href="/map" active={onMap} icon={<MapIcon className="h-4 w-4" />} label="Map" testId="link-nav-map" />
            <NavLink href="/account" active={location === '/account'} icon={<UserRound className="h-4 w-4" />} label="Account" testId="link-nav-account" />
            <LogoutButton compact />
          </nav>
        </div>
      </header>
      <main className={`relative z-10 mx-auto ${width} px-5 pb-20 pt-8 md:px-8 md:pt-12`}>{children}</main>
    </div>
  );
}
