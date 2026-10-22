# Feature 5 — Interactive travel map

## Production prerequisite and review boundary

The owner personally merged PR #10, republished, and explicitly verified
Feature 4 validation in production. GitHub confirmed the merge and latest main
before `feature/map` was created. The published deployment has a successful
Autoscale build. Agent read-only HTTP checks returned:

| Live request | Result |
|---|---|
| `/` | 200 |
| `/api/healthz` | 200 |
| `/api/__clerk/v1/environment` | 200 |
| `/api/trips` without authentication | 401 |

Authenticated production validation is **owner-confirmed**, not an agent login.
No production records were changed, no new release was published, and allocation
remains owner-controlled at 1 vCPU / 1.0 GiB / maximum 1 machine.
This map feature is development-only until personal PR review/merge and Publish.

## Shipped surface

- Protected `/map`: select a trip from the user's real journal.
- Protected `/trips/:id/map`: selected trip map; accessible from trip detail
  and the Map navigation link. Leaflet loads lazily rather than on every page.
- Standard OpenStreetMap raster tiles with visible linked attribution; real
  zoom/pan, numbered markers, React-rendered stop popups and automatic bounds.
- Map click starts a named stop at chosen coordinates. Manual coordinate inputs
  remain available for keyboard/mobile users. New/edit draft pin distinguishes
  uncommitted location from persisted stops.
- Full stop fields: name, latitude/longitude, optional visit date, optional
  free-text stop type, Driving/Flying/Other/no transport, and notes.
- Add/edit/delete (with confirmation), move up/down, ordered itinerary, and
  refreshed map/list data after changes and reloads.
- Map-first mobile layout and collapsible itinerary; header icon links retain
  accessible names and do not force horizontal scrolling on narrow phones.
- Loading/empty/error/retry states, tile-error notice, no fabricated trip data.
- Draft warnings for trip/stop changes and in-app navigation links; beforeunload
  warning for full reload/close. While editing an existing stop, map clicks are
  off until explicitly enabled, preventing accidental relocation.
- User-scoped query keys, refetch-on-focus/mount, mutation invalidation and
  404/409 recovery. Background list refresh never replaces the editor's values.

There are **no connecting lines**, road-route claims, ORS calls or routing keys.
No accommodations, stars, search, dashboard or Feature 6 behavior.

## API, ownership and validation

All paths are beneath `/api` and require the existing authenticated internal
user identity. Parent ownership is checked in server SQL, never from request
IDs/email/headers. Unknown/unowned parents return identical 404 responses.

| Method | Path | Result |
|---|---|---|
| GET | `/trips/:tripId/stops` | Ordered stop array |
| POST | `/trips/:tripId/stops` | Created stop, 201 |
| GET | `/trips/:tripId/stops/:stopId` | Owned stop |
| PUT | `/trips/:tripId/stops/:stopId` | Replaced editable fields |
| DELETE | `/trips/:tripId/stops/:stopId` | Deleted, 204 |
| PUT | `/trips/:tripId/stops/order` | Atomically reordered array |

Stop UUID and trip UUID must match the same owned parent. Supplying another
user's stop under one's own trip also fails; known UUIDs are not authorization.
Every stop operation locks the owned parent row inside a transaction. This
serializes concurrent edits/appends/reorders with each other and parent deletion.

Order is deterministic (`sort_order`, UUID tie-breaker for historical ties).
Creating without `sortOrder` appends; explicit positions insert at 0…count.
Editing without it preserves current position; explicit positions move the
stop within the itinerary. Deletion compacts positions. Successful mutations
produce contiguous zero-based positions. All position writes commit together.
No schema changes or new uniqueness constraint are needed.

Reorder accepts **every current stop ID exactly once**. Duplicate/malformed
input is 400. Missing/extra/foreign/stale IDs are 409 with no partial changes;
the client reloads the itinerary and asks the user to retry. Concurrent complete
permutations serialize; last successful transaction order wins.

The same custom Zod schema runs in browser and server:

- Trimmed nonblank name ≤200 UTF-16 units.
- Strict finite numeric latitude −90…90, longitude −180…180; do not coerce
  request strings, null, booleans or arrays. Normalize to existing six-decimal
  numeric storage. Blank editor coordinates are missing, **not zero**.
- Optional real Gregorian `YYYY-MM-DD` visit date, years 0001–9999.
  It need not fall inside parent dates; the approved schema adds no such rule.
- Nonnegative integer sort order within PostgreSQL integer range and valid
  current list position.
- Optional stop type ≤100, notes ≤20,000. Nonblank notes retain line breaks/
  whitespace; blank text clears to null. NUL rejected before SQL.
- Only Driving/Flying/Other/null transport, matching existing DB constraints.
- Strict writable-field allowlist; no supplied owner, trip, stop UUID/timestamps.
- Safe field/root messages without untrusted-value reflection; malformed JSON
  400, existing 100 KiB request limit 413, unsupported JSON media/encoding 415.

Existing trip/auth/DB logic and the approved PLAN.md are unchanged.

## Real automated verification

**178 tests passed across 7 files**: existing 110 regressions plus 33 HTTP/DB
stop cases and 35 shared stop-validation checks.
[Actual complete output](../evidence/tests/map-full-suite.txt).

Only Clerk's external identity/profile boundary is mocked. Express, auth
middleware, Drizzle, transactions, foreign keys and development PostgreSQL are
real. Tests cover:

- Full CRUD, all fields, optional clearing, precision/limit/date boundaries,
  empty stops, insertion/moving/compaction, parent deletion cascade.
- Before/after complete-row comparisons after invalid creates/updates.
- Concurrent appends and reorders, tied legacy ordering, stale/permutation errors.
- Cross-user parent/stop UUID combinations, read/create/edit/delete/reorder
  denials, unauthenticated/forged identity attempts and record preservation.
- Invalid coordinates, types, NUL, names, dates, modes, positions, metadata,
  malformed roots/JSON/media and UUIDs.

Full workspace TypeScript checks passed. Frontend and API production builds
passed; [actual build output](../evidence/tests/map-production-builds.txt).
The map is a separate lazy JS/CSS chunk. Existing nonblocking tooltip source-map,
frontend main-chunk and backend bundle-size warnings remain.

### Actual development browser results

The requested desktop and **390×844 mobile** lifecycle passed using
programmatic Clerk testing claims and real map interactions:

- Eight observed real OSM tile responses were 200; attribution, zoom controls,
  numbered markers and auto-bounds were visible. No connecting route lines.
- Map clicks populated draft coordinates. Blank names and latitude 91 produced
  actionable inline errors without a stop POST; values were retained.
- Named stops, visit date/type/transport/notes were saved and visible in the
  itinerary/markers. Second and mobile stop creations returned **201**.
- Edit starts with map-picking off; enabling it allowed deliberate relocation.
  Saved coordinates were confirmed in detail and after reload.
- Both reorder directions returned **200**; persisted names and marker numbers
  agreed after reload. Positions remained contiguous.
- Dirty trip switching and header All Trips navigation both asked before
  discarding. Keep editing retained values; confirmed switching showed an empty
  second trip with no stale markers, then restored the first trip's itinerary.
- Mobile document/client widths matched (375px with its scrollbar), no horizontal
  overflow. Collapse hid the itinerary body and grew the map from about 437px
  to 606px; expanding restored the list.
- Actual mobile map tap created another stop (201). Cancel deletion kept it;
  confirming deletion returned **204** and removed row/marker, compacting order.
- Deliberately blocked only external tiles: useful notice appeared while
  stops/API data stayed visible. Removed interception and normal tiles recovered.
  Intentional `net::ERR_FAILED` messages are not an unexplained app outage.
- The initial first-stop create and edit response statuses were not captured by
  the browser listener. Their saved values and reload persistence were checked;
  backend integration tests separately assert create201/update200.

One real browser issue was found: selecting another itinerary row left the old
marker popup open. The fix makes each marker's popup track selected state.
Frontend typecheck/build passed again. A focused recheck of **only this issue**
confirmed marker A → itinerary B → marker A leaves exactly the matching popup,
row/highlight/detail after the brief transition settles. Both extra map-click
fixture creates in that recheck were observed 201. No broader second pass.
No unexpected API/application errors were observed; development Clerk/WebGPU
warnings were nonblocking.

All three synthetic browser trips were removed through confirmed trip deletion.
A before-login ID baseline and actual `/api/auth/me` UUID proved the internal
test account was new; it was removed only after confirming no other trips/stars.
All four baseline development accounts remain. Post-test queries found zero
trips/stops/stays/stars and zero reserved backend-test accounts. External helper
identity removal was not attempted through unsupported methods. No production
data was used for these checks.

## Extended Test A — genuine red and green evidence

The existing trip-isolation regression still passes. The extension verifies
that User B cannot list/create/read/edit/delete/reorder User A's stops, cannot
substitute User A's stop under User B's trip, and leaves the original records
unchanged.

1. The full suite passed with the owned parent predicate in place.
2. Temporarily removed **only** `trips.userId = authenticatedUserId` from the
   shared parent-lock query. This was a controlled development-test defect,
   never a deployed release or live workflow build.
3. Ran the actual targeted isolation test. It failed: unauthorized list returned
   **200 instead of 404**; command exited 1.
4. Restored the predicate; SHA-256 comparison confirmed byte-identical store
   source to the full-suite passing version. Same targeted test passed.

| Evidence | Raw output | Screenshot |
|---|---|---|
| Controlled defect, actual failure | [red](../evidence/tests/stop-isolation-red.txt) | [red image](../evidence/tests/stop-isolation-red.jpg) |
| Restored protection, actual pass | [green](../evidence/tests/stop-isolation-green.txt) | [green image](../evidence/tests/stop-isolation-green.jpg) |

[Exact controlled change](../evidence/tests/stop-isolation-controlled-defect.diff).
Screenshots are browser captures of the **actual captured Vitest output**
(HTML escaping only), not fabricated terminal illustrations. Targeted runs
contain 1 executed case / 32 skipped; these are not full-suite results.
Temporary evidence-rendering pages were removed before production builds.

**What it proves:** server-side parent ownership guards all stop operations,
not merely hidden buttons or UI filtering. A valid stop/trip UUID does not
grant access. It exercises real SQL and checks preserved original rows.

**What would break it:** dropping owner qualification from the shared parent
query, bypassing that helper in a new stop route, or trusting client owner IDs.
The red run demonstrates the first defect is actually detected. It is not a
formal audit of all authentication/Clerk infrastructure.

## Limitations and next production checkpoint

- Public OSM tiles require network access and follow OSM availability/fair-use
  policy. Standard attribution and normal browser cache/referrer behavior are
  retained; no bulk/offline prefetch, geocoding or paid map provider.
- Coordinates are rounded to six decimals; no GPS recording or historical-path
  reconstruction. Polar raster coverage is limited by the map projection.
- No cross-tab conflict versioning for ordinary edits: last valid save wins.
  Reordering protects stop-set completeness, not arbitrary simultaneous edits.
- Browser-history navigation and logout can still discard an unsaved editor;
  managed in-app links/trip selection and full unload are warned. Saved records
  remain durable. No claim of offline draft storage.
- Production map functionality cannot be verified before this PR is personally
  merged and republished. Then check live add/edit/reorder/delete and mobile map,
  while retaining the existing resource allocation, before considering Feature 6.
