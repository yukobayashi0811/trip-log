# Feature 7 — Accommodation verification

## Production prerequisite

Before implementation, PR #14 was confirmed merged to `main` at
`20bd1095b22bc88f10a603cf58da2c0b7448ef05`. The published app,
`https://trip-log.replit.app`, returned HTTP 200; `/api/healthz` and the Clerk
environment endpoint returned HTTP 200, and unauthenticated `/api/trips`
returned the expected HTTP 401. A read-only production schema check found all
five expected tables, including `stays`. The user had already verified
production sign-in, account synchronization, reload and logout after PR #14.
No production records were changed during this feature.

## Implementation

- Uses the existing `stays` table, unique `stop_id` constraint and cascade
  behavior. No schema change, migration, paid service or deployment setting was
  added.
- The nested endpoints are `GET`, `POST`, `PUT` and `DELETE` at
  `/api/trips/:tripId/stops/:stopId/stay`. They derive ownership from the
  authenticated server user, lock the parent trip, and verify that the stop
  belongs to that trip before accessing a stay. User IDs and ownership fields
  are not accepted from the client.
- Stop-list and stop-detail responses include `stay: null | Stay`, so saved
  details reload into the selected-stop panel, ordered itinerary, map workspace
  and trip detail page.
- The editor accepts only Hotel, Campground, Vacation Rental or Other. It
  validates real calendar dates and requires check-out to be after check-in.
  Past/future and trip-boundary restrictions are not imposed. Rating is
  optional and, when provided, must be an integer from 1 through 5. Empty
  optional notes normalize to `null`; nonblank text is preserved.
- A second stay on a stop returns a conflict without changing the existing
  record. Deleting a stay leaves its stop and trip intact. The stop-delete
  confirmation warns that its accommodation is removed as part of the existing
  cascade.

## Automated verification

The real PostgreSQL integration suite mocks only the external Clerk identity
boundary. The Feature 7 tests cover create/read/update/delete, all four types,
ratings 1 and 5, leap-day dates, dates outside the trip range, invalid calendar
dates and ordering, malformed and unknown inputs, preservation after failed
writes, duplicate stays, multiple stays in one trip, cross-user/cross-trip UUID
substitution, unauthenticated requests and stop cascades.

Final recorded checks:

- `pnpm --filter @workspace/api-server test` — 236 tests passed.
- `pnpm run typecheck` — passed for shared libraries and all workspace
  applications.
- `pnpm --filter @workspace/api-spec run codegen` — passed.
- `PORT=21377 BASE_PATH=/ pnpm run build` — passed, including the Trip Log
  frontend and API server production builds. Vite reported the existing
  `tooltip.tsx` source-map warning and the frontend bundle-size advisory; neither
  prevented the build.

The Feature 7 ownership red/green evidence is in
[`evidence/tests/README.md`](../evidence/tests/README.md). The focused test
proved User B's request for User A's known trip and stop is denied. Removing
the `trips.user_id = authenticated user` condition made the test fail with an
unexpected HTTP 200 instead of 404; restoring the predicate made it pass.
The same protection would be broken by removing the owner predicate, trusting
a client-supplied user ID, or looking up a stay by stop UUID without verifying
the authenticated user's parent trip and the stop-to-trip relationship.

## Browser verification limitation

The authenticated add/edit/delete/reload flow was not exercised in a real
browser during the original Feature 7 implementation. The production app was
not republished with this unmerged work. The authenticated desktop and mobile
UI flow still requires verification before treating the feature as
production-verified.

## Follow-up verification after PR #16 review

### State and date fixes

- The accommodation panel is now keyed by selected stop ID, so its React-local
  form state is recreated when selection changes.
- The parent tracks whether accommodation values differ from that stop's
  starting values. Switching stops, opening another stop editor, closing the
  itinerary panel, leaving the map, or opening a new stop asks for confirmation
  before discarding a dirty stay draft. Canceling keeps Stop A selected with its
  values intact; confirming clears the draft before navigation. Full-page
  navigation also uses the existing unsaved-change warning.
- Draft-state regression tests cover clean, edited, reverted, and different-stop
  baselines. They exercise the shared comparison/initial-value helpers; they are
  not a substitute for the authenticated UI switch flow.
- Calendar validation now rejects year `0000`. An API integration test verifies
  a `400` field-validation response and confirms no stay row is saved.
- A routing integration test uses a mocked provider, creates a stay, captures a
  ready road-route response, deletes only the stay, then verifies the stop and
  route response are unchanged. No external routing service is called.

### Latest checks

- `pnpm --filter @workspace/api-server test` — **240 tests passed** in 11 files.
- `pnpm run typecheck` — passed across shared libraries, API, web app, scripts,
  and sandbox.
- `PORT=21377 BASE_PATH=/ pnpm run build` — passed for the Trip Log frontend,
  API server, and sandbox. Vite still reports the existing tooltip source-map
  warning and bundle-size advisory.
- After restarting the development workflows, local `/api/healthz` returned
  `200`; unauthenticated `/api/trips` returned the expected `401`.
- No production data, authentication settings, Autoscale settings, or published
  deployment were changed.

### Authenticated browser verification remains outstanding

I could not run the requested signed-in desktop/mobile CRUD flow in this
session. The Preview screenshot capture is non-interactive and starts
unauthenticated. Although this project uses managed Clerk with a separate
development instance, no authorized isolated test identity or executable
programmatic sign-in helper was available in the workspace. No password, token,
cookie, or secret was inspected, and production authentication was not bypassed.
No authenticated CRUD screenshots were captured; the API tests and screenshots
from Test A are not being presented as browser CRUD evidence.

The following manual browser checks remain before merging: create a stay, reload,
edit it, reload, delete it, and verify the stop and displayed road route remain;
then enter unsaved values for Stop A, switch to Stop B, cancel the discard
confirmation and verify A's values remain, then confirm discard and verify B
shows only its own stay or a blank form. Repeat the authenticated CRUD and stop
switch checks at desktop and mobile widths.
