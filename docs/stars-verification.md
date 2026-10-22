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

## Authenticated browser limitation and manual checklist

An authorized, isolated development browser identity was not available in this
session. The available browser capture is signed out; no Clerk login was
bypassed, no credentials were inspected, and no production data was touched.
The screenshots above show the actual backend test output, not browser
verification of the application UI.

Before considering the feature live-verified, sign in with a development test
account and synthetic trip, then check:

1. At desktop and mobile widths, star a trip from All Trips; confirm the saved
   icon/label changes and the trip appears on Starred Trips.
2. Open the trip from Starred Trips and confirm Trip Detail shows the same
   saved state. Reload, then sign out and back into the same account; confirm
   the star remains.
3. Unstar from Trip Detail and confirm it disappears from Starred Trips. With
   no stars remaining, confirm the empty message and All Trips link.
4. Repeat the toggles using keyboard navigation; verify focus visibility,
   labels, loading, error/retry behavior, and that a failed request does not
   change the displayed saved state.
5. Use a second development account and verify the first account's favorites
   never appear there. Confirm existing trip CRUD, map stops, accommodations,
   and road routes still work.

Feature 9 search/filter/sort and Feature 10 dashboard remain out of scope.
