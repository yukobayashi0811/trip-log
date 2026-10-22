# Trip ownership regression evidence

These files contain actual Vitest output from the real Express/PostgreSQL
integration test. The external Clerk boundary alone is mocked.

Run sequence required by PLAN.md: establish green; deliberately remove the
owner comparison from the shared ID predicate; record red; restore the
comparison; record green. The defect is confined to synthetic development test
records, never published, and never committed as working application code.

Screenshots render the **verbatim saved runner output** in a browser for
legibility. They are not fabricated result summaries or screenshots of a
terminal application. The raw text files, exact commands, UTC times, source
hashes, and the controlled diff are retained alongside the screenshots.

- [Initial green](trip-isolation-initial-green.txt)
- [Red output](trip-isolation-red.txt) / [red screenshot](trip-isolation-red.jpg)
- [Restored green output](trip-isolation-green.txt) / [green screenshot](trip-isolation-green.jpg)
- [Controlled defect](controlled-defect.diff)
- [Final full suite: 46 passing tests](trip-crud-full-suite.txt)

The focused runs predate the final additional payload-format test: 20 trip
tests then, 21 in the final suite. The isolation test and owner predicate are
unchanged. The focused screenshots make no claim that skipped tests passed.

## Feature 7 — stay ownership

This separate red/green pair exercises the nested stay API against the real
PostgreSQL integration fixture. It checks read, create, update and delete using
User B's session with User A's known trip and stop IDs. The only controlled
change was removing the authenticated user condition from the stay store's
parent-trip query; the focused test then observed HTTP 200 where it required
404. Restoring that condition returned the same focused test to green. This
shows that the test detects the owner-check failure; it does not claim that the
Clerk provider itself was exercised by the test.

- [Red test output](accommodation-isolation-red.txt) /
  [red screenshot](accommodation-isolation-red.jpg)
- [Restored green output](accommodation-isolation-green.txt) /
  [green screenshot](accommodation-isolation-green.jpg)
- [Red run command, UTC time and defect hash](accommodation-isolation-red-meta.txt) /
  [restored green run metadata and source hash](accommodation-isolation-green-meta.txt)
- [Exact temporary owner-check diff](accommodation-isolation-controlled-defect.diff)

The screenshots render the saved focused Vitest output and distinguish skipped
tests from the one targeted isolation test. See
[`docs/accommodation-verification.md`](../../docs/accommodation-verification.md)
for full-suite results and the outstanding authenticated-browser limitation.

## Feature 7 follow-up regression coverage

The latest full API suite includes year-0000 rejection, draft-value comparison
and different-stop baseline tests, plus an integration test proving that stay
deletion leaves the stop and mocked-provider road-route response unchanged.
The authenticated desktop/mobile Preview flow could not be run with the
available non-interactive, signed-out browser; no CRUD screenshots are claimed.
See [`docs/accommodation-verification.md`](../../docs/accommodation-verification.md)
for the exact limitation and remaining manual checks.

## Feature 8 — star ownership

This controlled red/green pair uses the real Express/PostgreSQL integration
fixture with only Clerk's external identity boundary mocked. It verifies that
User B cannot star, unstar, list, or read User A's known trip; it also attempts
forged user ID headers/body/query values. The controlled defect removes only the
authenticated-user predicate from the trip ownership lock in the star endpoint.
The same test then receives HTTP 200 instead of its required 404. Restoring the
predicate makes that targeted test pass again.

This proves that the test detects that specific missing server-side ownership
check. It does not test Clerk's identity provider itself or authenticated
browser behavior. The complete Feature 8 API suite separately covers
idempotence, persisted favorites, empty/list results, invalid IDs, multiple
users/trips, unauthenticated requests, and trip-delete cascade.

- [Actual red Vitest output](stars-isolation-red.txt) /
  [red screenshot](stars-isolation-red.jpg)
- [Restored green output](stars-isolation-green.txt) /
  [green screenshot](stars-isolation-green.jpg)
- [Exact temporary owner-check diff](stars-isolation-controlled-defect.diff)
