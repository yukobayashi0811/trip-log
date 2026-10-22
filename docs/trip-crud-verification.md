# Feature 3 — Trip CRUD verification

## Production prerequisite (before Feature 3)

The owner personally merged Feature 2 and republished it. Read-only verification
on 2026-10-22 found:

- Active public Autoscale deployment with a successful build:
  **https://trip-log.replit.app**.
- All five public tables: `users`, `trips`, `stops`, `stays`, `stars`.
- Development/production schema diff: **no pending changes**.
- Two production user rows with two distinct Clerk IDs, matching the pre-publish
  count. Both creation timestamps predate the Feature 2 republish. The reviewed
  publish SQL contained no alterations/deletions of users. No account details
  were retrieved. This is consistency evidence, not a complete before/after
  comparison of every account field.
- `/`, `/api/healthz`, `/api/__clerk/v1/environment` returned HTTP 200.
- Unauthenticated `/api/auth/me` returned HTTP 401.
- **Owner-confirmed manual production verification:** sign in, “Account
  synchronized,” reload, and log out all worked.

The owner confirmed resources remain **1 vCPU, 1.0 GiB RAM, max 1 machine**.
The agent did not change publishing settings, services, production schema/data,
or publish Feature 3. Feature 3 makes no database schema changes.

## Implemented behavior

`/trips` lists only the signed-in account's records. `/trips/new` creates one;
`/trips/:id` opens it; `/trips/:id/edit` replaces its editable fields.
Deletion requires explicit confirmation, warns that dependent records are
permanently deleted, and supports cancellation. Pending requests disable repeat
submissions. Save/delete update relevant query caches and navigation. The
existing account/login/logout experience remains available.

The API derives internal ownership from Clerk, never from the body, query
string, or forged headers. Owner scoping is included in each SQL read,
update, and delete, rather than a browser-only check or check-then-unscoped write.
Owner mismatch and absent records both yield 404. Private responses are
`Cache-Control: no-store`.

Validation includes required/trimmed title (≤200), region (≤200), trip type
(≤100), notes (≤20,000), real ISO calendar dates, and end ≥ start. One-day trips
are valid. Dates are not converted into timezone-dependent timestamps.
Empty optional text becomes null. Unknown fields are rejected; UUIDs and creation
timestamps remain server/database-owned. Malformed JSON returns 400 and oversized
payloads return 413, without exposing internal error details.

## Required test A: plain-English explanation

User A creates a trip through the real HTTP API. User B signs in through a
different mocked external identity, gets a distinct real internal PostgreSQL
account, and creates a separate trip. B's list includes B's trip only. Even
knowing A's exact UUID, B gets 404 on GET, PUT, and DELETE. A's row still exists
unchanged in PostgreSQL. Unauthenticated callers get 401 for every trip
operation. Separate tests reject forged owner fields and identity headers.

The test uses the **real Express application, authentication guard, account
synchronization, Drizzle queries, and development PostgreSQL**. Only Clerk's
external SDK identity/profile boundary is mocked. It does not independently
test Clerk signature verification or production login; those are separate
checks.

### Genuine controlled-defect red/green evidence

1. Correct code: the targeted isolation test passed.
2. Intentionally removed only `eq(trips.userId, userId)` from the shared
   owned-trip SQL predicate.
3. Actual red run: B received **GET 200, PUT 200, DELETE 204**, instead of all
   404s. The test failed. Only unique synthetic fixtures were affected.
4. Restored the owner predicate and reran: the isolation test passed.

This is a realistic regression: a developer looks up a globally unique trip
UUID without checking the signed-in owner, perhaps incorrectly relying on
hidden UI links or database foreign keys. The screenshot does not invent a
failure; its raw log records the exact incorrect HTTP statuses.

- [Initial green raw output](../evidence/tests/trip-isolation-initial-green.txt)
- [Controlled defect](../evidence/tests/controlled-defect.diff)
- [Actual red raw output](../evidence/tests/trip-isolation-red.txt)
- [Actual red screenshot](../evidence/tests/trip-isolation-red.jpg)
- [Restored green raw output](../evidence/tests/trip-isolation-green.txt)
- [Restored green screenshot](../evidence/tests/trip-isolation-green.jpg)

The screenshots are browser captures of **verbatim saved Vitest output**, not
terminal-application screenshots or synthetic test-result summaries. Raw logs
contain commands, UTC times, and route-source SHA256 hashes; initial/restored
hashes match. The temporary evidence-rendering HTML was removed and is not
shipped. No intentional defect remains in application code or production.
These captures cover the targeted test; skipped tests in that focused run are
not claimed as passing. The full suite is verified separately.

## Checks and scope

Backend coverage includes the complete owned CRUD lifecycle, persistence on
refetch, optional-field clearing, list isolation/order, all unauthenticated
methods, forged metadata, invalid/unknown IDs, invalid input on create and
update without side effects, cascades, preservation of other records, and safe
malformed/oversized payload errors. Temporary API accounts use the reserved
`test_auth_trip_` prefix and are deleted with cascading fixture cleanup.

API contract and generated hooks/types were regenerated from OpenAPI.
Orval query output is explicitly React Query v5; the client TS library includes
DOM iterables for the generated header-handling code. No dependencies or
technology stack were changed.

### Final actual results

- `pnpm run typecheck`: passed across shared libraries, API, web app, scripts,
  and sandbox.
- `LOG_LEVEL=error pnpm --filter @workspace/api-server test`: **46 passed,
  3 files** (21 trip API tests, 16 relational database tests, 9 auth tests).
  [Unmodified full-suite output](../evidence/tests/trip-crud-full-suite.txt).
- Frontend production build passed using the configured service's
  `PORT=21377 BASE_PATH=/`; API build/start passed via its managed workflow.
  Both workflows restarted successfully once after the coherent code batch.
- Nonblocking Vite warnings: source-map location in the existing tooltip
  component and a minified chunk just above 500 kB (about 154 kB gzip).
- One development browser pass succeeded: native required-field rejection,
  real POST 201, detail reload persistence, PUT 200, optional-region/type
  clearing, multiline notes, updated list, 390×844 layout without horizontal
  overflow, delete Cancel without DELETE, confirmed DELETE 204, deleted-trip
  GET 404, and signed-out redirect/API 401. No unexpected application error.
- Browser observations used programmatic Clerk test claims, not the Clerk
  sign-up UI or production identity. The first authenticated list response
  listener attached too late to record that status; loaded states were observed,
  and real backend list behavior is covered by integration tests.
- Post-test SQL: **zero trips, stops, stays, stars, or reserved backend-test
  users remain**. The browser's synthetic trip was deleted through the UI.
  Its helper did not expose a safe account deletion/mapping; a narrowly scoped
  development cleanup by the reported synthetic email matched zero records.
  No account was deleted based on an unproven identity mapping. A development
  Clerk test identity may remain; no test journal data remains.

The changed CRUD UI is verified in development, **not production**. Production
still intentionally serves merged Feature 2 until this feature is personally
reviewed, merged, and republished.

No map, stops UI, routing, stays UI, stars, search, dashboard, or Feature 4.
Extend this ownership test only when those planned features are implemented.
The approved PLAN.md is unchanged. No unmerged code is published.
