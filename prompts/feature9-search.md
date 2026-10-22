Implement **Feature 9 — Search, Filter, and Sort Trips** for Trip Log.

Use **Free Mode**. This is the next approved original feature following the successful production verification of Feature 8.

Repository: `yukobayashi0811/trip-log`

## 1. Approved scope

Follow the existing, frozen `PLAN.md`:

"As a traveler, I want title search, region/year/starred filters, and newest/oldest sorting so that I can find saved trips."

Implement the functionality primarily on the existing **All Trips** page.

Required behavior:

- Case-insensitive, trimmed, partial-match search against trip titles.
- Region filter using the current user's existing destination regions.
- Year filter based on the calendar year of `trip.startDate`, using date-only semantics without timezone-related year shifts.
- A starred-only filter, defaulting to all trips.
- Newest-first and oldest-first sorting by trip start date.
- All search, filter, and sort options must work together.
- A clear/reset control and accurate matching-result count.
- A distinct "no matching trips" state, separate from the existing "no trips created" state.

Maintain deterministic ordering when start dates are equal.

## 2. Architecture

Inspect the current implementation before making changes.

The existing authenticated `GET /api/trips` endpoint returns the user's trips, and Feature 8 provides their starred trips.

Prefer reusing those existing APIs and implementing filtering and sorting through a small, testable client-side utility if that is sufficient for the current personal-journal scale.

Do not add server-side search endpoints, pagination, database indexes, migrations, or new dependencies unless a concrete technical requirement makes them necessary. Document the rationale if you decide otherwise.

Continue to enforce authorization on the backend. Client-side filtering must never be treated as an authorization boundary.

Use data from the authenticated user's account only.

## 3. UX requirements

- Preserve the existing Trip Log visual design, navigation, trip cards, and star controls.
- Place compact, intuitive search/filter/sort controls above the All Trips list.
- Support desktop and mobile layouts.
- Provide accessible labels, keyboard navigation, and visible focus states.
- Derive region and year options from the current user's trips, handling missing regions, repeated region names, and empty data.
- Keep star/unstar changes synchronized with the starred-only filter.
- Do not break trip creation, navigation, editing, or deletion.
- Handle loading and request failures without incorrectly displaying an empty-results state.

## 4. Tests

Add real automated tests for the search/filter/sort behavior.

Cover at least:

- Case-insensitive partial title matches.
- Leading/trailing whitespace in a search query.
- Empty search and no-match behavior.
- Region filtering with missing or duplicated values.
- Year filtering, including boundary and cross-year trips.
- Starred-only filtering.
- Newest/oldest order and deterministic ties.
- Combined filters and clearing all filters.
- Reactive changes after starring or unstarring a trip.
- Account isolation and unauthorized access through existing authenticated APIs.

Prefer focused pure-function tests for filtering/sorting plus appropriate integration tests. Do not introduce a new test framework unnecessarily.

Run the complete existing regression suite, workspace TypeScript checks, OpenAPI generation if applicable, and both production builds.

Perform authenticated desktop/mobile browser verification if an authorized Development test environment is available. Record real results, screenshots, and limitations. Never invent test evidence or bypass authentication.

Preserve existing Test A ownership protection and do not implement Feature 10's Dashboard Test B prematurely.

## 5. GitHub workflow

Follow the existing approved development process:

1. Inspect and confirm the latest merged GitHub `main`, including Features 1–8 and the post-merge setup fix.
2. Preserve the publishing workspace, local backup branches, setup configuration, and any unrelated Agent task work.
3. Create a dedicated Feature 9 GitHub Issue with the user story, scope, acceptance criteria, and test plan.
4. Create a new feature branch from the latest `main`, for example `feature/trip-search`.
5. Save this actual implementation prompt and development decisions under `prompts/`.
6. Implement Feature 9 only.
7. Add genuine tests and verification evidence.
8. Update README and relevant documentation, and update `schema.md` only if factual schema documentation needs clarification.
9. Open a PR linked with `Closes #<issue number>`.
10. Stop for my review.

Do not commit directly to `main`, merge the PR, or Publish automatically.

## 6. Strict exclusions

Do not implement:

- Feature 10 Dashboard or travel statistics.
- Place-name geocoding/autocomplete.
- Estimated flying routes or flight-map enhancements.
- New social, sharing, or rating features.
- Authentication redesign.
- Unnecessary database schema changes.
- New paid APIs or infrastructure.

Keep `PLAN.md` unchanged and preserve the existing Autoscale settings.

Do not modify production data or disturb the currently published Feature 8 application.

## 7. Completion report

When the Feature 9 PR is ready, report:

- Issue and PR links.
- Feature branch and exact commit SHA.
- Files changed and important implementation decisions.
- Automated test counts and build/typecheck results.
- Actual authenticated browser test results.
- Security and regression checks.
- Any remaining limitations.

**Stop at an unmerged PR. I will review, merge, and Publish manually.**
