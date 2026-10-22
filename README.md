# Trip Log

**Your journeys, mapped.** A private travel journal built feature-by-feature
according to the approved [PLAN.md](PLAN.md).

## Implemented foundation

Public landing page, embedded Clerk sign-up/sign-in, logout, and a protected
account page backed by PostgreSQL. Feature 2 adds the complete relational
foundation: `users`, `trips`, `stops`, `stays`, and `stars`, with constraints,
indexes, cascading foreign keys, and typed Drizzle relationships.

Feature 3 adds owner-scoped trip creation, listing, details, editing, and deletion
with explicit confirmation. Forms support title, date-only start/end dates,
region, trip type, and notes. Loading, retryable error, not-found, and honest
empty states are included.

Feature 4 shares trip validation rules/messages between browser and server,
with accessible field feedback and safe request handling.

Feature 5 adds the interactive Leaflet/OpenStreetMap travel map, trip selection,
numbered stop markers/popups, automatic bounds, map-click coordinates, and named
stop creation/editing/deletion/reordering. The ordered itinerary and map stay
synchronized; mobile users can collapse the itinerary. Full validation,
parent-trip ownership and transactional ordering use the existing stops schema.
See [map verification and evidence](docs/map-verification.md).

Feature 6 adds server-owned **Estimated Driving Route** geometry through ordered
Driving stops, including intermediate and recorded return points. Flying/Other
transitions have no lines. Transient deduplication, validation, free-plan request
budgets, cooldowns and failure states preserve saved stops when ORS is unavailable.
The owner added server-only `ORS_API_KEY`; existence is confirmed in both
environments. Real ORS browser checks passed, including mixed-mode sections and
a nonzero recorded A→B→A return route. Provider/browser verification details and
the tooltip capture limitation are documented below.
See [routing verification, limits, setup and evidence](docs/routing-verification.md).

Feature 7 adds owner-scoped accommodation CRUD for one stay per stop, with
Hotel/Campground/Vacation Rental/Other types, date ordering, optional ratings and
notes, and shared frontend/backend validation. Stays appear in the itinerary,
selected-stop map panel, and trip detail. Deleting a stay leaves its stop intact;
deleting a stop also removes its stay through the existing foreign-key cascade.
The approved database schema already contained the stay table, so this feature
adds no migration or deployment resource. See
[accommodation verification and evidence](docs/accommodation-verification.md).
Favorites, journal search and dashboard remain unimplemented.

## Stack and setup

Node.js 24, pnpm 10, React/TypeScript/Vite, Express 5, Replit-managed Clerk,
PostgreSQL/Drizzle, Leaflet/React Leaflet with OpenStreetMap tiles,
openrouteservice Standard Free (server-side native fetch), Vitest.

1. Install dependencies: `pnpm install --frozen-lockfile`.
2. In Replit, provision managed Clerk through the Auth integration and use the
   project's managed development PostgreSQL database. Never commit credentials.
   Required server variables: `DATABASE_URL`, `CLERK_SECRET_KEY`,
   `CLERK_PUBLISHABLE_KEY`; browser build variable:
   `VITE_CLERK_PUBLISHABLE_KEY` (public key only).
3. Apply the development schema: `pnpm --filter @workspace/db run push`.
4. Run the managed workflows `artifacts/api-server: API Server` and
   `artifacts/trip-log: web`. Their manifests supply `PORT`, `BASE_PATH`, and
   proxy paths. API is `/api`; the web app is `/`.

Outside Replit, run the two package dev commands with their own `PORT` values
and `BASE_PATH=/` for Vite, behind a same-origin reverse proxy routing `/api`
to Express and `/` to Vite. Do not expose secrets to the browser.

## Checks

```sh
pnpm run typecheck
pnpm --filter @workspace/api-server test
pnpm --filter @workspace/api-spec run codegen
```

Integration tests require the development schema/database. They mock Clerk's
external identity boundary, not PostgreSQL, use uniquely prefixed synthetic
test identities, and remove only their own rows after the run.
See [authentication verification](docs/auth-verification.md) for actual results
and [database verification](docs/database-verification.md) for the database tests
and the historical database checkpoint. See [Trip CRUD verification](docs/trip-crud-verification.md)
and [actual ownership regression evidence](evidence/tests/README.md) for Feature 3.
The full backend suite passes **240 tests** across authentication, schema,
trip/stop/stay/routing API integration, provider safety and shared/HTTP validation. The Feature 3 CRUD browser
journey passed on desktop/mobile; the focused Feature 4 validation browser
journey passed on desktop.
Feature 5's actual desktop/mobile map-click CRUD/reorder/collapse browser
journey passed; a popup-selection issue was fixed and specifically rechecked.
See its verification document for genuine evidence and capture limitations.
Feature 4 shares one validation schema between browser and API, adds consistent
inline messages and an accessible linked error summary, and keeps intentional
whitespace in nonblank notes. See [validation verification](docs/validation-verification.md)
for the improvements over Feature 3, boundaries, and current results.
Database fixtures roll back; API integration tests remove their own synthetic
accounts and dependent records. No tests invent genuine travel history.

## Code map

- `artifacts/trip-log`: browser UI, embedded account forms, shared visual styles
- `artifacts/api-server`: Express, Clerk production proxy, guarded account/trip APIs
- `lib/db`: Drizzle schema/database connection
- `lib/api-spec`: source OpenAPI contract and generation configuration
- `lib/api-client-react`, `lib/api-zod`: generated client and response validation
- `schema.md`: all five tables, constraints, relationships, and future ownership conventions
- `prompts/`: actual development instructions and decision records

## Authentication and authorization foundation

Clerk owns passwords and browser sessions. Browser requests use same-origin
session cookies, not browser-managed bearer tokens. Express verifies sessions
with Clerk middleware. `GET /api/auth/me` derives Clerk identity on the server,
loads its verified primary email from Clerk, and atomically inserts/updates an
internal user keyed by unique Clerk ID. The response never contains credentials
or the external Clerk ID and is marked `Cache-Control: no-store`.

Future private routes must mount `requireUser` and scope database queries to
`res.locals.user.id`. Never accept ownership from client IDs or email addresses.
Trip operations already use this guard. Reads, updates, and deletes include both
the trip UUID and the authenticated internal owner UUID in the SQL predicate.
Unknown and non-owned trips return the same 404; unauthenticated operations
return 401. Create never accepts client-supplied ownership. No role/admin system.

## Trip API

All routes require a verified Clerk session and resolve its internal UUID.

| Method | Path | Result |
|---|---|---|
| GET | `/api/trips` | Own trips, newest start date first |
| POST | `/api/trips` | Create own trip; 201 |
| GET | `/api/trips/:id` | Own trip or 404 |
| PUT | `/api/trips/:id` | Replace editable fields of own trip |
| DELETE | `/api/trips/:id` | Delete own trip and descendants; 204 |

Input: `title`, `startDate`, `endDate`, optional `destinationRegion`, `tripType`,
`notes`. PUT is a full form replacement, not a partial patch: title/dates are
required, and omitted/empty/null optional fields clear their old values.
Calendar dates remain `YYYY-MM-DD` strings. Single-line text is trimmed;
nonblank notes keep their spacing and line breaks; blank optional values become
null. Nonblank title,
real dates, end ≥ start, and bounded field lengths are enforced server-side.
Unknown properties (including owner/id/timestamps) and embedded NUL characters
are rejected. Invalid fields return actionable `fields` messages; invalid
root objects/unknown fields use `formErrors`. JSON parse errors return 400,
requests over 100 KiB return 413, and unsupported media/encoding returns 415.

## Review and publishing

All changes use Issues, feature branches, prompt logs, tests, and reviewed PRs.
Only the owner merges. After each merged feature, once deployable, review costs,
publish through the owner-controlled Replit Publish flow, and verify the live
feature before starting the next one. Development and production Clerk users
and databases are separate. Authentication, the five-table schema, Trip CRUD,
validation and Feature 5 map/stops are published at https://trip-log.replit.app;
the owner confirmed the production map/stop interactions after republishing.
Feature 6 is development-only until personally merged and owner-republished;
real ORS access additionally needs its server-only secret.
Replit applies managed production schema changes through Publish; no application
startup DDL or production migration script is used.
