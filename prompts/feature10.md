# Feature 10 — actual prompt log

## Owner request (verbatim)

Feature 9 has been merged, published, and successfully verified in production.

Please proceed with **Feature 10 — Dashboard**, the final feature in the original approved PLAN.md.

Implement a responsive dashboard showing:
- Total number of trips
- Total number of stops
- Total accommodation nights
- Number of trips by month, based on trip start dates

Requirements:

1. Follow the frozen PLAN.md without modifying its original requirements.
2. Reuse existing database tables and APIs where practical. Prefer efficient, authenticated, owner-scoped aggregation.
3. Calculate accommodation nights using date-only check-in/check-out differences, avoiding timezone errors.
4. Prevent double counting caused by joins between trips, stops, stays, and stars.
5. Implement the mandatory **Test B**: two stays totaling exactly three nights must produce a dashboard total of three nights. Include another user's trips/stays and additional stops/stars to verify isolation and avoid duplicate aggregation.
6. Perform genuine controlled red/green testing for Test B, preserving the required evidence.
7. Add appropriate loading, error, empty, and retry states.
8. Maintain the current visual design and mobile responsiveness.
9. Run complete API regression tests, TypeScript checks, production builds, and authenticated browser verification.
10. Create a dedicated GitHub Issue, feature branch from the latest main, actual prompt log, verification evidence, and a PR linked to the Issue.

Preserve the publishing workspace and existing backups. Do not modify production data, Autoscale settings, or authentication configuration.

Do not implement the separately planned map enhancements, geocoding, or flight routes in this PR.

Do not merge or Publish automatically. Stop with a fully tested, unmerged PR for my final review.

## Agent actions and delegated prompts

- Fetched `github/main` at `e445ccc870a3522ff32beb10e4e4b427fae759f1`.
  Opened Issue #25 and isolated `feature/dashboard`; retained the actual publishing checkout.
- Implemented a single authenticated snapshot query with independent trip/stop/stay aggregates,
  no stars join, calendar-date subtraction, and chronological year-month grouping.
- Frontend design delegation (scope excerpt): “Implement ONLY Dashboard frontend in isolated
  checkout ... Do not edit the root publishing workspace ... maintain its existing warm,
  personal visual design, not a new style.” Provided generated API hooks, protected route,
  owner-keyed query, responsive semantic monthly table, loading/error/retry/empty requirements.
  Removed optional decorative bars to keep the requested numeric monthly table minimal.
- First integration run found a test fixture URL missing the existing trip parent segment.
  Corrected the test URL, not application behavior. Dashboard suite then passed 7 tests.
- Test B ran green, then with the explicit temporary `+1` nights mutation in
  `evidence/tests/dashboard/controlled-mutation.diff`, then green after restoration.
  Raw logs and Chromium captures are retained; no deliberate defect remains.
- Final commands, authenticated browser instructions/results and exact tested-source
  provenance are recorded in `docs/dashboard-verification.md`.

## Frontend worker prompt (actual text)

> Implement ONLY Dashboard frontend in isolated checkout /home/runner/workspace/generated-artifacts/feature10-worktree. Do not edit the root publishing workspace. Trip Log is a private travel journal for travelers recording real journeys; maintain its existing warm, personal visual design, not a new style. Feature10 scope: /dashboard shows totalTrips, totalStops, totalAccommodationNights, and tripsByMonth [{month: YYYY-MM, tripCount}] from real authenticated API. Use useGetDashboard and getGetDashboardQueryKey from @workspace/api-client-react; query key must include userId, retry:false, refetchOnMount:always, refetchOnWindowFocus:true, consistent with trips pages. Add protected route receiving userId and navigation link in AppShell, accessible mobile. Keep authentication untouched. Loading, error with retry, honest empty states, zeros for new accounts; never show stale totals after fetch error. Present months as accessible semantic TABLE (no chart needed); chronological month/year labels, only recorded start months, note trip starts not stay dates, across all years, zero months omitted. Use date-string splitting not local-time parsing. Do not add year filtering or other features. No emojis. Invest in tasteful micro-interactions consistent with existing UI. Use real product colors already in theme. Create files before importing. No unused imports. Do not edit backend/API spec/generated files, PLAN.md, configurations, dependencies, docs, evidence, Git refs or commits. Relevant API generated already has getDashboard/useGetDashboard. Work only in the specified isolated checkout. Report files and decisions.

## Browser verification dispatch and actual execution

The requested built-in testing worker was sent an isolated-dashboard journey
covering real development sign-in, zeros, A's 2-trip/4-stop/3-night fixture,
start-month rows, reload, desktop/mobile, loading/500/retry, B's 1/1/10 fixture,
returning to A, screenshots and owner-only cleanup. Dispatch failed immediately
with `Unknown config kind: testing`, before browser execution.

The main Agent then used the established real Clerk Development ticket +
Chromium/CDP approach in `evidence/dashboard-browser/run.mjs`, not an auth bypass.
Actual instructions and assertions are executable in that script. The first
attempt had an invalid synthetic email; the second used an ineffective
visibility event for a hidden window. Both raw results are retained. The third,
corrected harness completed **20 passing assertions** with no application changes.
It covered the requested journey, and all created trips/Clerk identities were
cleaned up. No user/prod data or authentication configuration was modified.
