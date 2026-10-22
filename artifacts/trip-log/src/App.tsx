import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { ClerkProvider, SignIn, SignUp, Show, useClerk, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Switch, Route, Redirect, Link, useLocation, Router as WouterRouter } from 'wouter';
import { ArrowRight, RotateCw, ShieldCheck, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useGetCurrentUser, getGetCurrentUserQueryKey } from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { AppShell } from '@/components/app-shell';
import { RequireAuth } from '@/components/require-auth';
import TripsListPage from '@/pages/trips-list';
import TripNewPage from '@/pages/trip-new';
import TripDetailPage from '@/pages/trip-detail';
import TripEditPage from '@/pages/trip-edit';
import StarredTripsPage from '@/pages/starred-trips';
import { AuthLoading } from '@/components/require-auth';

const TripMapPage = lazy(() => import('@/pages/trip-map'));

const queryClient = new QueryClient();

// REQUIRED — copy verbatim.
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

// REQUIRED — copy verbatim.
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || '/'
    : path;
}

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: 'hsl(174 42% 28%)',
    colorForeground: 'hsl(172 28% 14%)',
    colorMutedForeground: 'hsl(170 10% 36%)',
    colorDanger: 'hsl(6 58% 44%)',
    colorBackground: 'hsl(42 45% 98.5%)',
    colorInput: 'hsl(40 40% 99%)',
    colorInputForeground: 'hsl(172 28% 14%)',
    colorNeutral: 'hsl(172 20% 30%)',
    fontFamily: "'Figtree', system-ui, sans-serif",
    borderRadius: '0.75rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[hsl(42_45%_98.5%)] rounded-2xl w-[440px] max-w-full overflow-hidden border border-[hsl(38_20%_84%)] shadow-[0_24px_60px_-30px_hsl(172_40%_20%/0.35)]',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: "text-[hsl(172_28%_14%)] text-2xl font-semibold [font-family:'Fraunces',serif]",
    headerSubtitle: 'text-[hsl(170_10%_36%)]',
    socialButtonsBlockButtonText: 'text-[hsl(172_28%_14%)] font-medium',
    formFieldLabel: 'text-[hsl(172_28%_14%)] font-medium',
    footerActionLink: 'text-[hsl(174_42%_26%)] font-semibold hover:text-[hsl(174_42%_20%)]',
    footerActionText: 'text-[hsl(170_10%_36%)]',
    dividerText: 'text-[hsl(170_10%_40%)]',
    identityPreviewEditButton: 'text-[hsl(174_42%_26%)]',
    formFieldSuccessText: 'text-[hsl(150_40%_26%)]',
    alertText: 'text-[hsl(6_58%_34%)]',
    logoBox: 'justify-center h-12',
    logoImage: 'h-12 w-12',
    socialButtonsBlockButton: 'border-[hsl(38_20%_80%)] bg-[hsl(40_40%_99%)]',
    formButtonPrimary: 'bg-[hsl(174_42%_28%)] text-[hsl(42_45%_97%)] shadow-none',
    formFieldInput: 'border-[hsl(38_18%_78%)] bg-[hsl(40_40%_99%)]',
    footerAction: 'justify-center',
    dividerLine: 'bg-[hsl(38_20%_84%)]',
    alert: 'border-[hsl(6_50%_80%)] bg-[hsl(6_60%_96%)]',
    otpCodeFieldInput: 'border-[hsl(38_18%_74%)]',
    formFieldRow: 'gap-3',
    main: 'gap-5',
  },
};

function usePageMeta(title: string, description: string) {
  useEffect(() => {
    document.title = title;
    document.querySelector('meta[name="description"]')?.setAttribute('content', description);
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', title);
    document.querySelector('meta[property="og:description"]')?.setAttribute('content', description);
  }, [title, description]);
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid="link-home">
      <img src={`${basePath}/logo.svg`} alt="" className="h-8 w-8" />
      <span className="font-display text-xl font-semibold">Trip Log</span>
    </Link>
  );
}

function RouteArt() {
  return (
    <svg viewBox="0 0 420 360" className="w-full h-auto" aria-hidden="true">
      <g stroke="hsl(38 20% 82%)" strokeWidth="1" fill="none">
        {[60, 120, 180, 240, 300].map((y) => <path key={y} d={`M0 ${y} Q 210 ${y - 24} 420 ${y}`} />)}
      </g>
      <path className="route-draw" d="M50 300 C 110 250, 90 190, 160 180 S 250 230, 290 150 S 340 70, 370 60" fill="none" stroke="hsl(174 42% 30%)" strokeWidth="3" strokeLinecap="round" strokeDasharray="2 9" />
      {[[50, 300], [160, 180], [290, 150]].map(([x, y]) => (
        <circle key={x} cx={x} cy={y} r="7" fill="hsl(42 45% 98%)" stroke="hsl(174 42% 28%)" strokeWidth="3" />
      ))}
      <path d="M370 34c-12 0-21 9-21 20 0 15 21 34 21 34s21-19 21-34c0-11-9-20-21-20z" fill="hsl(36 70% 62%)" />
      <circle cx="370" cy="54" r="7" fill="hsl(42 45% 98%)" />
    </svg>
  );
}

function Landing() {
  usePageMeta('Trip Log — Your journeys, mapped.', 'A private travel journal for road trips, parks, camping, and family vacations.');
  return (
    <div className="paper-grain min-h-[100dvh] relative">
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-5 py-5 md:px-8">
        <Brand />
        <Link href="/sign-in" className="rounded-full px-4 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-accent hover:text-foreground" data-testid="link-sign-in-header">
          Log in
        </Link>
      </header>
      <main className="relative z-10 mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-8 md:grid-cols-[1.1fr_0.9fr] md:px-8 md:pt-16">
        <div>
          <p className="rise text-xs font-semibold uppercase tracking-[0.2em] text-primary">A private travel journal</p>
          <h1 className="rise font-display mt-4 text-5xl leading-[1.02] md:text-7xl" style={{ animationDelay: '80ms' }}>
            Your journeys,<br /><em className="text-primary">mapped.</em>
          </h1>
          <p className="rise mt-6 max-w-md text-lg leading-relaxed text-muted-foreground" style={{ animationDelay: '160ms' }}>
            Keep the road trips, park weekends, and campsite nights you don't want to forget — in a journal only you can open.
          </p>
          <div className="rise mt-9 flex flex-wrap items-center gap-3" style={{ animationDelay: '240ms' }}>
            <Link href="/sign-up" className="group inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3.5 font-medium text-primary-foreground transition-transform active:scale-[0.98] hover:bg-primary/90" data-testid="link-sign-up">
              Start your journal <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link href="/sign-in" className="rounded-full border border-border px-6 py-3.5 font-medium transition-colors hover:bg-card" data-testid="link-sign-in">
              I already have an account
            </Link>
          </div>
          <p className="rise mt-8 flex items-center gap-2 text-sm text-muted-foreground" style={{ animationDelay: '320ms' }}>
            <ShieldCheck className="h-4 w-4 text-primary" /> Private by default. No sharing, no feeds.
          </p>
        </div>
        <div className="rise rounded-[2rem] border border-card-border bg-card/70 p-6" style={{ animationDelay: '200ms' }}>
          <RouteArt />
        </div>
      </main>
    </div>
  );
}

function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="paper-grain flex min-h-[100dvh] flex-col items-center justify-center gap-6 bg-background px-4 py-10">
      <div className="relative z-10 w-full flex justify-center">{children}</div>
      <Link href="/" className="relative z-10 text-sm text-muted-foreground hover:text-foreground" data-testid="link-back-home">
        ← Back to Trip Log
      </Link>
    </div>
  );
}

function SignInPage() {
  usePageMeta('Log in — Trip Log', 'Log in to your private Trip Log journal.');
  return (
    <AuthShell>
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </AuthShell>
  );
}

function SignUpPage() {
  usePageMeta('Sign up — Trip Log', 'Create your private Trip Log travel journal.');
  return (
    <AuthShell>
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </AuthShell>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClient = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        queryClient.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, queryClient]);

  return null;
}

function AccountCard({ clerkUserId }: { clerkUserId: string }) {
  const { isLoaded, isSignedIn, user } = useUser();
  const ready = isLoaded && !!isSignedIn && user?.id === clerkUserId;
  const { data, isLoading, isError, error, refetch, isFetching } = useGetCurrentUser({
    query: { enabled: ready, queryKey: [...getGetCurrentUserQueryKey(), clerkUserId], retry: false },
  });

  if (!ready || isLoading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading account" data-testid="status-loading">
        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        <div className="h-7 w-64 max-w-full animate-pulse rounded bg-muted" />
        <div className="h-16 w-full animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  if (isError || !data) {
    const status = (error as { status?: number } | null)?.status;
    const msg = status === 401
      ? 'Your session could not be verified. Try again, or log out and back in.'
      : status === 503
        ? 'Account service is temporarily unavailable. Give it a moment and retry.'
        : "We couldn't reach your account just now.";
    return (
      <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-5" data-testid="status-error">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div>
            <p className="font-medium">Account sync didn't finish</p>
            <p className="mt-1 text-sm text-muted-foreground">{msg}</p>
            <button type="button" onClick={() => refetch()} disabled={isFetching} className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60" data-testid="button-retry">
              <RotateCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} /> Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rise">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Signed in as</p>
      <p className="font-display mt-2 break-all text-2xl md:text-3xl" data-testid="text-email">{data.email}</p>
      <div className="mt-6 flex items-start gap-3 rounded-xl bg-accent/70 p-4" role="status" data-testid="status-sync">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div className="text-sm">
          <p className="font-medium text-accent-foreground">Account synchronized</p>
          <p className="mt-0.5 text-muted-foreground">
            Your private journal is ready. Member since{' '}
            <span data-testid="text-created-at">{new Date(data.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</span>.
          </p>
        </div>
      </div>
    </div>
  );
}

function AccountPage() {
  usePageMeta('Your account — Trip Log', 'Your private Trip Log account.');
  const { user } = useUser();
  return (
    <AppShell width="max-w-3xl">
      <h1 className="font-display text-4xl md:text-5xl">Your account</h1>
      <p className="mt-2 text-muted-foreground">The private account behind your journal.</p>
      <section className="mt-8 rounded-2xl border border-card-border bg-card p-6 md:p-8">
        {user ? <AccountCard key={user.id} clerkUserId={user.id} /> : <div className="h-24 animate-pulse rounded-xl bg-muted" />}
      </section>
      <Link href="/trips" className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline" data-testid="link-account-trips">Open your trips <ArrowRight className="h-4 w-4" /></Link>
    </AppShell>
  );
}

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in" fallback={null}><Redirect to="/trips" /></Show>
      <Show when="signed-out"><Landing /></Show>
    </>
  );
}

function AccountRoute() {
  return <RequireAuth>{() => <AccountPage />}</RequireAuth>;
}

const TripsRoute = () => <RequireAuth>{(uid) => <TripsListPage userId={uid} />}</RequireAuth>;
const StarredTripsRoute = () => <RequireAuth>{(uid) => <StarredTripsPage userId={uid} />}</RequireAuth>;
const TripNewRoute = () => <RequireAuth>{(uid) => <TripNewPage userId={uid} />}</RequireAuth>;
const TripDetailRoute = () => <RequireAuth>{(uid) => <TripDetailPage userId={uid} />}</RequireAuth>;
const TripMapRoute = () => <RequireAuth>{(uid) => <Suspense fallback={<AuthLoading />}><TripMapPage userId={uid} /></Suspense>}</RequireAuth>;
const TripEditRoute = () => <RequireAuth>{(uid) => <TripEditPage userId={uid} />}</RequireAuth>;

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: { start: { title: 'Welcome back', subtitle: 'Log in to open your travel journal' } },
        signUp: { start: { title: 'Start your Trip Log', subtitle: 'A private place for every journey' } },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <TooltipProvider>
          <RoutedErrorBoundary>
            <Switch>
              <Route path="/" component={HomeRedirect} />
              <Route path="/sign-in/*?" component={SignInPage} />
              <Route path="/sign-up/*?" component={SignUpPage} />
              <Route path="/account" component={AccountRoute} />
              <Route path="/trips" component={TripsRoute} />
              <Route path="/starred" component={StarredTripsRoute} />
              <Route path="/trips/new" component={TripNewRoute} />
              <Route path="/map" component={TripMapRoute} />
              <Route path="/trips/:id/map" component={TripMapRoute} />
              <Route path="/trips/:id/edit" component={TripEditRoute} />
              <Route path="/trips/:id" component={TripDetailRoute} />
              <Route component={NotFound} />
            </Switch>
          </RoutedErrorBoundary>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
