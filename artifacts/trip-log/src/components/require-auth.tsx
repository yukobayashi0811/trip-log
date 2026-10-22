import type { ReactNode } from 'react';
import { useUser } from '@clerk/react';
import { Redirect } from 'wouter';

export function AuthLoading() {
  return (
    <div className="paper-grain flex min-h-[100dvh] items-center justify-center" aria-busy="true" data-testid="status-auth-loading">
      <div className="relative z-10 flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-pulse rounded-full border-2 border-primary/40 bg-accent" />
        <p className="text-sm text-muted-foreground">Opening your journal…</p>
      </div>
    </div>
  );
}

export function RequireAuth({ children }: { children: (userId: string) => ReactNode }) {
  const { isLoaded, isSignedIn, user } = useUser();
  if (!isLoaded) return <AuthLoading />;
  if (!isSignedIn || !user) return <Redirect to="/sign-in" replace />;
  return <div key={user.id} className="contents">{children(user.id)}</div>;
}
