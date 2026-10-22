# Trip Log

**Your journeys, mapped.** A private travel journal built feature-by-feature
according to the approved [PLAN.md](PLAN.md).

## Current feature: Authentication

Public landing page, embedded Clerk sign-up/sign-in, logout, and a protected
account page backed by PostgreSQL. Only the `users` table exists at this stage.
Trips, maps, accommodations, routing, stars, search, and statistics are not
implemented yet.

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
and remaining verification limitations.

## Code map

- `artifacts/trip-log`: browser UI, embedded account forms, shared visual styles
- `artifacts/api-server`: Express, Clerk production proxy, guarded account API
- `lib/db`: Drizzle schema/database connection
- `lib/api-spec`: source OpenAPI contract and generation configuration
- `lib/api-client-react`, `lib/api-zod`: generated client and response validation
- `schema.md`: currently implemented schema and ownership conventions
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
No role/admin system or trip-level authorization is claimed by this feature.

## Review and publishing

All changes use Issues, feature branches, prompt logs, tests, and reviewed PRs.
Only the owner merges. After each merged feature, once deployable, review costs,
publish through the owner-controlled Replit Publish flow, and verify the live
feature before starting the next one. Development and production Clerk users
and databases are separate. No production release has been claimed here.
Replit applies managed production schema changes through Publish; no application
startup DDL or production migration script is used.
