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
empty states are included. The map, routing, stops/accommodations UI, favorites,
search, and dashboard are not implemented yet.

## Stack and setup

Node.js 24, pnpm 10, React/TypeScript/Vite, Express 5, Replit-managed Clerk,
PostgreSQL/Drizzle, Vitest.

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
The full backend suite passes **46 tests** across authentication, schema, and
trip API integration. The signed-in CRUD browser journey also passed on desktop
and mobile.
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
Calendar dates remain `YYYY-MM-DD` strings. Text is trimmed; nonblank title,
real dates, end ≥ start, and bounded field lengths are enforced server-side.
Unknown properties (including owner/id/timestamps) are rejected.

## Review and publishing

All changes use Issues, feature branches, prompt logs, tests, and reviewed PRs.
Only the owner merges. After each merged feature, once deployable, review costs,
publish through the owner-controlled Replit Publish flow, and verify the live
feature before starting the next one. Development and production Clerk users
and databases are separate. Authentication and the five-table Feature 2 schema
are published at https://trip-log.replit.app. Feature 3 is development-only
until its PR is personally merged and the owner republishes.
Replit applies managed production schema changes through Publish; no application
startup DDL or production migration script is used.
