# Feature 8 — Starred Trips verification

## Implementation

Feature 8 reuses the approved `stars` table as-is. No migration, second
favorites table, dependency, paid service, production data change, or publishing
resource change is included.

- `GET /api/starred-trips` returns only trips both starred by and owned by the
  authenticated internal user, newest start date first. Responses are `no-store`.
- `PUT /api/trips/:tripId/star` inserts with conflict-ignore semantics; repeated
  calls consistently return `200 {"isStarred":true}` and cannot duplicate the
  composite-key record.
- `DELETE /api/trips/:tripId/star` removes only the current user's star and
  consistently returns `200 {"isStarred":false}`, including when already
  unstarred.
- Both mutations validate UUIDs, lock the trip row and verify ownership from
  the server session before touching stars. Invalid IDs return 400; nonexistent
  and unowned trips return the same 404 without exposing trip details.
- Trip deletion continues to rely on the approved database cascade. Star
  mutations never create or delete trips.

All Trips and Trip Detail read the current user's server-backed starred list.
Their accessible controls show a filled saved state or an outlined unsaved
state, disable during requests, and do not optimistically claim success after a
failed request. Starred Trips has loading, retryable error, empty and populated
states; each trip opens the existing detail page. The shared query is keyed by
the Clerk user and the existing Clerk account-change listener clears cached
queries on sign-out/account switching.

## Automated verification

- OpenAPI code generation completed and regenerated the TypeScript client.
- Workspace TypeScript checks passed.
- Full API regression suite: **248 tests passed in 12 files** against development
  PostgreSQL. Only the external Clerk identity boundary is mocked; the database,
  Express middleware, SQL and HTTP handlers are real. Fixtures use synthetic
  test identities and cleanup; production was not accessed by the test suite.
- API and frontend production builds passed with the exact commands and build
  environment declared in their artifact manifests.
- Existing frontend build advisories about the tooltip source map and bundle
  chunk size remain nonfatal.

### Test A — controlled star ownership red/green

The test first passed against the implementation. The temporary defect removed
only the `trips.user_id = authenticated_user.id` condition from the star
endpoint's locked ownership query. With that defect, User B's attempt to star
User A's known trip returned 200 instead of the required 404; the targeted test
exited 1. Restoring the predicate made the same targeted test pass with exit 0.
The application source is restored and the temporary defect is not committed.

This demonstrates that the integration test detects removal of this
server-side ownership check. It does not prove the Clerk provider itself or
authenticated browser behavior, because the test supplies synthetic session
identities at the Clerk boundary.

Evidence (raw output includes command, UTC time, exit code, and source/test
hashes):

- [Actual red run](../evidence/tests/stars-isolation-red.txt) /
  [red screenshot](../evidence/tests/stars-isolation-red.jpg)
- [Restored green run](../evidence/tests/stars-isolation-green.txt) /
  [green screenshot](../evidence/tests/stars-isolation-green.jpg)
- [Exact controlled defect diff](../evidence/tests/stars-isolation-controlled-defect.diff)
- [Evidence explanation](../evidence/tests/README.md#feature-8--star-ownership)

## Authenticated browser verification — completed and accepted

The earlier lack of an authorized browser identity was resolved in a separate
development sandbox. The exact implementation at
`dff12a83086f02a0f9982d1b1988f68960a7655e` passed **27 recorded browser
assertions** at desktop 1280×900 and mobile 390×844. Two synthetic Development
Clerk users signed in through legitimate, short-lived Clerk-issued tickets;
authentication middleware was not bypassed. Both users and all local database
fixtures were removed after testing. No production data was accessed.

Checks covered starring/unstarring in All Trips and Trip Detail, Starred Trips
contents, reload/sign-in persistence, account isolation, keyboard activation,
mobile touch/layout, failed PUT/DELETE requests retaining the actual saved
state, and successful mutation/list retries.

The [accepted parent report](stars-isolated-parent-verification.md) contains
the precise scope, genuine signed-in screenshots, raw logs, and cleanup counts.
The earlier red/green backend screenshots remain distinct from that real
browser evidence. The evidence is now included in this PR's file changes,
not merely linked from a separate branch.

Application behavior remains unchanged by reconciliation, so the accepted
browser run remains applicable. Final API, TypeScript, and production-build
rerun results are recorded against the exact PR head in the PR description.

### Remaining limits

- This is isolated Development verification, not published-site verification.
- The API suite mocks the external Clerk boundary; the browser run used real
  Clerk Development sessions.
- The browser run verifies Feature 8 behavior, not an exhaustive new browser
  regression of every previously implemented map, routing, and stay flow.
- Final Task #6 reconciliation remains gated on receiving and inspecting its
  actual returned diff. See [reconciliation status](stars-reconciliation.md).

Feature 9 search/filter/sort and Feature 10 dashboard remain out of scope.
