# Trip Log — Initial Project Plan

**Deadline:** November 4, 2026. Planning draft: implementation starts only after
the owner personally merges this PR and confirms.

## 1. Pitch

**Trip Log — Your journeys, mapped.** preserves travel memories through private
trips, ordered geographic stops, overnight stays, and estimated road routes.
It serves road trips, parks, camping, family vacations, and other travel—not
booking, social networking, or AI planning.

**Proposed usage, subject to owner approval:** record at least five genuine
previous trips this semester and update the journal after each new trip.
The owner supplies the real travel details; the app also welcomes other travelers.

## 2. Features — Ten User Stories in Implementation Order

One feature per PR, following this planning PR; no additional prerequisite PRs.

1. **Accounts:** As a traveler, I want in-app sign-up, login, and logout so that my records remain private.
2. **Database:** As a traveler, I want relationally stored trips, stops, stays, and stars so that my history persists reliably.
3. **CRUD:** As a traveler, I want to create, list, open, edit, and delete trips with deletion confirmation so that my journal stays accurate.
4. **Validation:** As a traveler, I want friendly frontend/backend input errors so that invalid records cannot be saved.
5. **Map:** As a traveler, I want trip selection, markers/popups, automatic bounds, map-click coordinates, manually named stops, and stop add/edit/reorder/delete so that I can record itineraries geographically.
6. **Routing:** As a traveler, I want estimated road routes through ordered driving stops, including intermediate stops and return trips, so that I can visualize journeys; Flying/Other must not appear as driving routes.
7. **Accommodations:** As a traveler, I want add/edit/delete for hotels, campgrounds, vacation rentals, and other stays at stops, visible on maps/itineraries, so that I remember overnight locations.
8. **Stars:** As a traveler, I want to star/unstar my own trips and view a dedicated favorites page so that I can revisit them easily.
9. **Search:** As a traveler, I want title search, region/year/starred filters, and newest/oldest sorting so that I can find saved trips.
10. **Dashboard:** As a traveler, I want total trips, stops, accommodation nights, and trips by month so that I understand my travel history.

All features use actual owner-scoped data. Basic safety validation accompanies
initial writes; feature 4 completes consistent validation. Stop/stay CRUD lands
with features 5/7. Reusable styles are part of normal UI development.

## 3. Database

PostgreSQL/Drizzle; database-generated UUID primary keys. Required fields are
NOT NULL; “optional” means nullable.

| Table | Columns, types, and constraints |
|---|---|
| `users` | `id uuid PK`; `clerk_user_id text NOT NULL UNIQUE`; `email text NOT NULL`; `created_at timestamptz NOT NULL DEFAULT now()` |
| `trips` | `id uuid PK`; `user_id uuid NOT NULL FK → users.id`; `title text NOT NULL`; `start_date date NOT NULL`; `end_date date NOT NULL`; optional `destination_region text`, `trip_type text`, `notes text`; `created_at timestamptz NOT NULL DEFAULT now()` |
| `stops` | `id uuid PK`; `trip_id uuid NOT NULL FK → trips.id`; `name text NOT NULL`; `latitude numeric(9,6) NOT NULL`; `longitude numeric(9,6) NOT NULL`; optional `visit_date date`; `sort_order integer NOT NULL`; optional `stop_type text`, `transport_from_previous text`, `notes text` |
| `stays` | `id uuid PK`; `stop_id uuid NOT NULL UNIQUE FK → stops.id`; `accommodation_type text NOT NULL`; `check_in date NOT NULL`; `check_out date NOT NULL`; optional `rating integer`, `notes text` |
| `stars` | `user_id uuid NOT NULL FK → users.id`; `trip_id uuid NOT NULL FK → trips.id`; `created_at timestamptz NOT NULL DEFAULT now()`; composite `PK(user_id, trip_id)` |

Relationships: `users 1 → many trips 1 → many stops 1 → zero-or-one stays`;
`users 1 → many stars ← many-to-1 trips`. All favorites share `stars`.
Cascade trip deletion to stops/stars and stop deletion to stays; reorder
atomically. Index foreign keys/owner dates. Check trimmed nonblank names/titles,
end ≥ start, latitude −90…90, longitude −180…180, nonnegative order,
check-out > check-in, ratings 1…5, and allowed transport/accommodation values.
Create users idempotently by unique Clerk ID; enforce ownership in backend
queries, including related records and stars. Never store passwords.

## 4. Tests

**A — Data isolation:** Given User A owns a trip, when User B reads, edits, or
deletes it by ID, then the backend denies access and preserves the record.
Start this test with trip CRUD after authentication/database foundations.
Extend it in the corresponding feature PRs to stop access/reordering, routing
lookups, accommodations, and stars; include unauthenticated requests.

**B — Dashboard:** Given a user has two stays totaling three nights, when
dashboard statistics are calculated, then total nights equals three. Add another
user's records and extra stops/stars to detect ownership errors/duplicate joins.
Use date-only night calculations and group trip starts by month.

Use Vitest/backend integration tests. For both tests, run green; introduce a
controlled defect; capture an actual red run; restore and capture green.
Save screenshots in `evidence/tests/`; link evidence, a plain-English explanation,
and a realistic breaking change in each relevant PR. Never fabricate results or
leave deliberate defects.

## 5. Technologies and Delivery

| Choice | Reason |
|---|---|
| Replit Agent | Automates development, documentation, and authorized GitHub operations. |
| React + TypeScript / Vite | Provides typed, responsive browser UI. |
| Express + TypeScript | Handles backend ownership, validation, and private API calls. |
| Replit PostgreSQL + Drizzle | Provides managed relational persistence and typed queries. |
| Replit-managed Clerk | Provides in-app accounts without application-stored passwords. |
| Leaflet + React Leaflet | Supports markers, map clicks, bounds fitting, and routes. |
| OpenStreetMap standard raster tiles | Supplies low-volume maps with attribution and tile-policy compliance; no bulk/offline prefetch. |
| openrouteservice Standard Free | Supplies estimated road geometry without paid routing infrastructure. |
| Vitest | Provides repeatable backend tests. |
| Private GitHub repository | Preserves Issues, branches, prompts, and reviewed PR history. |
| Replit publishing, proposed Autoscale | Keeps hosting on the existing platform, subject to cost review. |

Routing: server-only `ORS_API_KEY`;
`POST https://api.heigit.org/openrouteservice/v2/directions/driving-car/geojson`;
coordinates `[longitude, latitude]`. Label **Estimated Driving Route**, never
historical GPS. Recalculate changed driving segments on coordinate/order/mode
changes; debounce/deduplicate requests. No permanent geometry storage without
verified licensing permission.

Sequence: planning PR → owner merge/confirmation → ten feature PRs in section 2
order (eleven PRs total). Each feature gets an Issue, branch from latest main,
actual prompt log, tests, and PR with `closes #N`, decisions/bugs/evidence.
Never auto-merge or commit directly to main. Stop for personal review/merge.
**After each merged feature PR, once the app is deployable, publish the update
and verify the changed feature on the live URL before starting the next feature.**
Check costs first, use the owner-controlled Publish action, and report the URL,
verification result, or any blocker honestly; planning is not deployable.

Maintain README.md, schema.md, prompts, and evidence. After development, preserve
the approved plan and append Plan vs. Reality using:
`Planned feature | Shipped / Changed / Cut | Status (Done/Backlogged) | Learning | What changed and why (one line)`.

## 6. Design

Warm off-white, muted teal/forest accents, readable typography, simple navigation,
clean cards/subtle borders, accessible states, and touch-friendly responsive UI.
Build reusable styles/components within normal UI feature work—no separate
design-system PR or prerequisite. Google My Maps/Polarsteps are inspiration only.

Pages: landing/sign-up/login, My Travel Map, All Trips, create/edit trip, trip
detail, Starred Trips, Dashboard. Desktop: large map/trip sidebar; mobile:
map-first/collapsible itinerary. Distinguish stays from stops. Detail shows dates,
region, map/routes, ordered stops/stays, notes, star/edit/delete. Use honest empty
states, not fabricated travel records.

## 7. Risks and Cuts

**Routing (highest risk):** missing key, timeouts, quotas, unreachable stops, and
distance/waypoint limits must preserve records/markers and show clear errors;
never replace failed driving geometry with straight lines. Verify provider
limits/licensing/attribution and compatible React/Leaflet versions.

**Availability:** PostgreSQL passed a read-only probe; Clerk/routing remain
unconfigured/untested. Verify separate production identities/data, live sign-up,
and database access. The authorized file-free `bootstrap/empty` commit established
main solely to enable this planning PR; no further direct main commits.

**Costs:** Core entitlement is user-reported; credits/safeguards remain unverified.
Check credits, usage alerts, and shutdown limits before publishing. No paid
services, upgrades, additional spending, or automatic paid quota fallback without
approval; no artificial trip/stop/stay limits.

**Cuts:** simplify optional geocoding/animation, never the seven mandatory or
three custom features. No AI planning, GPS tracking/reconstruction, galleries,
sharing, public profiles, booking, expenses, native apps, or paid maps without
approval. The owner supplies genuine trip data and handles usability testing,
academic reflections, and submission separately.

## Plan vs. Reality

Features 1–10 are complete and merged. The owner confirmed the PR #28 first-stop
improvement was published and verified in production. This table records
documented outcomes; it does not add unverified per-feature production checks or
write the owner's academic reflection.

| Planned feature | Shipped / Changed / Cut | Status (Done/Backlogged) | Learning | What changed and why (one line) |
|---|---|---|---|---|
| 1. Accounts | Shipped | Done | Authenticated user data must be exercised, not just login. | Existing Replit-managed Clerk foundation retained. |
| 2. Relational database | Shipped | Done | Parent ownership remains an API responsibility. | Approved five-table schema retained. |
| 3. Trip CRUD | Shipped | Done | Cross-account tests must verify records survive denied writes. | Owner-scoped create/list/detail/edit/delete delivered. |
| 4. Validation | Shipped | Done | Calendar dates need more than a date-shaped regex. | Shared validation extended rather than duplicated. |
| 5. Interactive map/stops | Shipped | Done | Stops need transactional ordering and parent ownership. | Named manual-coordinate stops shipped; geocoding enhancements are separate. |
| 6. Road routing | Shipped | Done | Provider failures must never alter saved stops. | Estimated road routes retained; no flight geometry added. |
| 7. Accommodations | Shipped | Done | Local edit state must belong to the selected stop. | One existing stay per stop; no new schema. |
| 8. Stars | Shipped | Done | Failed requests cannot be reported as successful favorites. | Existing stars table and private favorites page reused. |
| 9. Search/filter/sort | Shipped | Done | Evidence must identify the tested application source precisely. | Existing owner-scoped APIs support combined client-side filters. |
| 10. Dashboard | Shipped | Done | Independent aggregate grains and calendar-date arithmetic prevent incorrect totals. | New authenticated aggregate read API; responsive metrics and monthly breakdown, no schema/dependency changes. |
| Stranger Test — first-stop action | Shipped | Done | The Stranger Test identified difficulty finding how to add the first stop after creating a trip. | Added a direct action from the successful zero-stop state to the existing map/stop workflow; other findings were left unchanged. |
