# Feature 6 — Estimated Driving Route

## Production prerequisite and boundaries

PR #12 was verified merged; `feature/routing` starts from latest main
`80873266e8e9dc31df4af35417787c5bab0b3e5f`. The owner republished and explicitly
confirmed production map/stop interactions. Agent read-only live checks at
https://trip-log.replit.app: `/`200, `/api/healthz`200,
`/api/__clerk/v1/environment`200, unauthenticated `/api/trips`401.
Publishing reports a successful public Autoscale build. Authenticated live map
verification is **owner-confirmed**, not an agent development test.

This PR is development-only. No deployment, schema/migration, authentication,
PLAN.md, paid service or resource change. Existing allocation remains
owner-controlled: 1vCPU, 1.0GiB, maximum one machine. Stop for owner review/merge;
Feature 7 is not started.

## Contract, ownership and routing semantics

`GET /api/trips/{tripId}/routes` requires the synchronized authenticated user.
400 for malformed IDs, 401 when signed out, identical404 for absent/unowned trips.
The owned saved stop snapshot is loaded before **any** provider/key/cache access.
Query-supplied coordinates, transport or user IDs cannot override it.
The parent lock is released before network work; routing never writes data.

200 returns `{tripId, stopRevision, segments}`; per-section failure states permit
partial availability without discarding successful independent road sections.
`stopRevision` is shared frontend/backend: ordered IDs/coordinates/arrival modes,
not names/notes/dates. The client hides old geometry during saved-stop changes
and rejects a response for a different revision, refreshing the itinerary.

- Sort by saved `sort_order`, then UUID for deterministic ties.
- An edge exists **only when the destination stop's**
  `transport_from_previous` is `Driving`.
- Consecutive driving edges become a request with all intermediate coordinates.
  Flying, Other and null break the run; neither lines nor requests bridge gaps.
- A recorded return to the first location remains an explicit final waypoint.
  This is not ORS's automatic `round_trip` option.
- Runs over50 waypoints are chunked with an overlapping endpoint (49-edge
  steps), preserving every leg without imposing a saved-stop limit.
- Only consecutive identical coordinates are collapsed for the provider.
  An entirely coincident section needs no request/line and has zero distance.

The fixed HTTPS endpoint is
`https://api.heigit.org/openrouteservice/v2/directions/driving-car/geojson`.
POST body contains only `[longitude, latitude]` coordinates,
`instructions:false`, `elevation:false`. Authorization is server-side.
Redirects are rejected, not followed with credentials. No names, notes, dates,
emails, user IDs or trip IDs are sent to ORS.

## Rendering and availability

The existing map renders only validated successful LineStrings, translating
GeoJSON longitude/latitude to Leaflet latitude/longitude. Bounds include roads
and saved markers; numbering, editing, mobile collapse and selection remain.
The heading/tooltip says **Estimated Driving Route**; roads are estimates, not
historical GPS or navigation advice. Flying/Other/unmarked transitions have no
lines. There is **no straight-line fallback**.

Missing key, rejected credentials, unreachable points, provider restrictions,
network/provider errors, invalid/oversized responses, timeouts and rate/quota
limits yield safe actionable section messages with no fabricated geometry.
The panel supports partial success and manual retry/cooldown. Stop markers,
saved order and CRUD remain independent of route availability.

Provider parsing allows only one FeatureCollection LineString, finite in-range
2D coordinates and finite nonnegative distance/duration. Byte limit4MiB,
point limit100,000 per provider response. Metadata/query/raw error bodies/headers
and thrown exception text are not forwarded or logged; these can contain keys.
Unknown provider errors use static messages.

## Free-plan requests, caching and licensing

Official sources checked2026-10-22:

- [Standard Free plans](https://account.heigit.org/info/plans):
  Directions V2 **2,000/day, 40/minute**, €0.
- [Restrictions](https://openrouteservice.org/restrictions/):
  **50 waypoints**, normal driving maximum **6,000km**. Alternative/automatic
  round-trip restrictions are different; this feature does not use those modes.
  A geographically valid point can still be unreachable by car.
- [Terms and attribution](https://openrouteservice.org/terms-of-service/):
  results **CC BY-SA4.0**, required attribution
  **© openrouteservice by HeiGIT | Data from OpenStreetMap**.

The UI includes linked HeiGIT/OSM attribution and CC BY-SA4.0 alongside existing
OSM tile attribution. Only driving coordinates are externally shared; the UI
discloses this. Provider terms/privacy apply; this is not a private offline router.
There is no permanent geometry storage, bulk prefetch, background polling,
geocoding, automatic retry, paid-plan upgrade or paid quota fallback.

Controls:

- Client650ms debounce, revision/user-scoped React Query key, five-minute
  freshness/garbage collection and no focus refetch.
- Server in-flight deduplication per owned trip/geometry/key fingerprint.
  Positive entries five minutes; failures cached for their cooldown or30seconds.
  Cached retry countdowns decrease with elapsed time.
- Transient cache≤64 entries and200,000 total vertices; in-flight entries≤128;
  actual simultaneous provider calls≤2. No persistent cache or DB geometry.
- Conservative warm-process rolling budgets **35/minute, 1,900/24hours**.
  These are request safety budgets, not trip/stop record limits.
- Provider429 pauses requests across scopes, honors numeric/date Retry-After
  (at least60seconds; does not shorten longer valid backoff), no retry loop.
- External attempt timeout10seconds; per-itinerary processing budget20seconds
  between chunks, so one final attempt can bring total close to30seconds.
  Remaining chunks return retryable busy while completed ones stay cached.

**Limitation:** budgets/caches are process memory. Cold starts/reset/other uses
of the same key can make local counters incomplete. The provider's account
quota/dashboard and429 remain authoritative; this is not a distributed quota
ledger. Actual road distance can exceed6,000km despite closer coordinates.
Provider restrictions can leave long sections unavailable; records remain saved.

## Secret setup and configuration checkpoint

Initial existence-only checks found `ORS_API_KEY` absent in development and
production. During verification the owner added it; subsequent existence-only
checks returned **present in both environments**. The managed development API
workflow was restarted to load it. No value was read, invented, logged or
committed; the controlled unit/integration tests make no real ORS requests.

1. Use [HeiGIT account management](https://account.heigit.org/) to select
   **openrouteservice Standard Free (€0)** and create/copy its API key.
   Do not select a paid plan or additional service.
2. In this project's Replit **Secrets** tool add key `ORS_API_KEY`; enter the
   value only in the secure secret field, never chat/source/prompt logs.
   Do not use a `VITE_` prefix.
3. Make it available to development's API server and restart that managed
   workflow if needed to load the environment. Check the saved driving itinerary
   and retry after any cooldown.
4. Production secret presence is already confirmed. For the later
   owner-controlled publish **after merge**, retain it in deployment secrets
   and republish. Do not publish this unmerged branch just to test it.

The server's missing-key state is functional, not a substitute fabricated route.
Real ORS authorization/quota/geometry verification is recorded separately from
controlled mocks below; key presence alone does not prove service health.

## Automated verification

**225 tests passed /9 files**: all previous178 plus47 new tests
(39 controlled provider/planning cases and8 real HTTP/PostgreSQL cases).
Only external Clerk/ORS are mocked; DB ownership, reads and saved mutations are real.

Covered: ordered/intermediate/return routes; mixed/null modes and missing
credentials;50-waypoint boundaries; coincident points; recalculation after
coordinate/order/mode/deletion changes; concurrent dedup; scoped/expired/rotated
cache; cache bounds;35/minute and1,900/day local guards;429 numeric/date/long
cooldowns; unreachable/restriction/auth/provider errors; malformed GeoJSON/JSON,
byte bounds, timeouts/abort; max concurrent calls; safe exceptions/metadata;
partial success; known foreign UUID/warmed-cache/unauth/forged-header denials.

The1,900-request unit case uses in-process Response mocks and a simulated clock,
**not1,900 external requests**.

- [Full suite raw output](../evidence/tests/routing-full-suite.txt)
- [Full workspace TypeScript and frontend/API production builds](../evidence/tests/routing-typecheck-builds.txt)

All checks passed. Existing nonblocking sourcemap/frontend chunk/backend bundle
size warnings remain; no unrelated bundling refactor.

## Actual development browser verification

The single focused desktop1280×800/mobile390×844 journey used explicitly
synthetic Heidelberg stops, real saved CRUD and actual OSM tiles.
Controlled browser response interception was **test-only** and removed before
the genuine provider check; it is not application fallback behavior.

- Initially the real server returned200 with two `missing_key` sections, empty
  geometry and setup notice. All six markers/itinerary stayed usable.
- Controlled ready geometry tested rendering and revision changes. Moving B
  changed the revision/line; pan/zoom and name-only changes caused no route
  request. Changing B's arrival mode to Flying split runs correctly.
- Controlled `rate_limited` responses removed failed lines, preserved markers/
  order, disabled retry for its countdown, then enabled it. No auto-request loop.
- Mobile document/client width matched375px with its scrollbar; map-first
  layout, collapse and retry/status controls had no horizontal overflow.
- After the owner added the key and the API workflow was restarted, an
  **unintercepted authenticated backend GET returned200 with both sections ready**.
  The UI reported **3.3km/about8min**. These are genuine ORS results, not the
  controlled renderer response.
- With the saved Flying edit, section B→C→ReturnA contained65 road vertices,
  **2,499m/392s**; the intermediate C and recorded return location were within
  about21m/14m of route vertices respectively. Flight→RoadAfterFlight was a
  separate17-vertex section, **799.2m/99.2s**. No ReturnA→Flight bridge.
  GeoJSON longitude/latitude was confirmed, all six markers remained and the
  real map had two Leaflet path overlays with linked licensing attribution.

One renderer check failed: Leaflet did not apply a CSS class supplied through
`pathOptions`/`setStyle`, preventing the intended path hover assertion. The
visible panel heading and actual road geometry already worked. The correction
moves the class to the top-level Polyline option and adds an accessible SVG
label. Frontend typecheck/production build passed again. Its focused follow-up
checked just the corrected path/tooltip and a small genuine A→B→A journey,
not a second broad lifecycle. **It passed:** one unintercepted backend GET200,
29 road vertices, **1,585.8m/192.4s**, identical snapped start/end about14m from A.
The UI showed1.6km/about3min and the path had the expected class, `role=img` and
`aria-label="Estimated Driving Route"`.

**Tooltip capture limit:** actual pointer movement to a computed SVG stroke
point did not conclusively surface the tooltip. Dispatching a bubbling
`mouseover` at that point did display it, captured in the genuine map screenshot.
Do not claim native pointer hover passed. The always-visible heading and
accessible path label are verified independently of hover.

An initial `.invalid` Clerk test address was rejected422 before any data was
created; a unique reserved example.com synthetic address resolved that test
setup issue. Transient401/Vite reconnect during interception/reload recovered;
the final genuine GET succeeded. Development Clerk/preload warnings are
nonblocking. No credential was inspected.

Both synthetic trips were deleted, the helper recorded its actual internal
UUID and signed out before account cleanup. That UUID was absent from the
pre-login baseline and had no remaining trips/stars; only that proven-new empty
internal account was removed. All four baseline accounts were preserved.
One unrelated trip and stop remained and were left alone; zero reserved
backend-test users remained. External helper identity removal was not attempted.
No production records were created or modified.

## Extended Test A — genuine red/green

1. Full225 green ran with the correct owner predicate.
2. Saved its source hash, temporarily removed only parent `user_id` matching.
3. Targeted routing isolation run genuinely failed: **expected404, received200**,
   actual Vitest exit1. UserB received UserA's route after UserA warmed the cache.
4. Restored the predicate, verified exact original source hash, ran same targeted
   test: **1 passed /7 skipped**. The skipped tests are not claimed as rerun.
5. Never rebuilt/restarted the live development server with the mutant.

Evidence: [exact defect](../evidence/tests/routing-isolation-controlled-defect.diff),
[red raw](../evidence/tests/routing-isolation-red.txt),
[green raw](../evidence/tests/routing-isolation-green.txt),
[red screenshot](../evidence/tests/routing-isolation-red.jpg),
[green screenshot](../evidence/tests/routing-isolation-green.jpg).
Images are real browser captures of HTML-escaped actual command output, not
staged app screenshots or invented test results. Temporary renderers were removed.

**Proves:** knowing a trip UUID (even a cached trip) is not authorization;
UserB cannot retrieve geometry/itinerary or cause provider work for UserA,
and saved rows remain unchanged. Routing is read-only.
**Would break it:** removing/bypassing the owned parent query, trusting a
client-supplied owner/coordinate set, or serving cache entries before authorization.
It does not prove real-provider credentials, road quality or production behavior.
