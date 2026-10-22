# Feature 9: Search, filter, and sort verification

All Trips reuses the authenticated trip and starred-trip queries; filtering is
client-side because the journal is a personal collection and does not need
server-side search, pagination, indexes, or schema changes. The server remains
the authorization boundary. Region/year options derive only from the signed-in
user's response data.

Start-year matching reads the `YYYY-MM-DD` date portion directly, so browser
timezone conversion cannot move a trip into a neighboring calendar year.
Newest/oldest sorting uses the same date-only ordering and breaks equal-date
ties by trip ID for stable results.

## Automated checks

- `pnpm --filter @workspace/trip-log run test:search` — 7 focused pure-function
  tests for trimmed case-insensitive partial titles, empty/no-match queries,
  blank and duplicate regions, year boundaries, starred-state changes,
  deterministic newest/oldest order, combined filters, and reset behavior.
- `pnpm --filter @workspace/api-server test` — **248 tests passed** across 12
  files; the existing trip/star API tests continue to cover owner-only access
  and account isolation.
- `pnpm run typecheck` — passed across workspace libraries, API, web, and
  scripts.
- The API and web production build commands from their artifact manifests both
  passed. The bundler retains its existing non-failing chunk-size and source-map
  warnings.
- OpenAPI generation was not applicable: this feature adds no API or schema
  changes.

## Authenticated browser checks

The Feature 9 branch was tested in an isolated Development browser using
provider-issued Clerk Development tickets and a private local PostgreSQL test
database. **64 of 64 assertions passed**, covering desktop and mobile search,
combined filters, result counts, empty/no-match separation, date-only
year-boundary behavior, stable sorting, keyboard navigation, successful
star/unstar reactivity, and a second authenticated account that could not list
the owner's fixtures or receive the owner's region/year options. The run also
reran the established Feature 8 browser regression checks.

Three synthetic Development identities and four search trips were created and
removed. The isolated test database was confirmed empty afterward. No
production identity or data was used.

Genuine browser screenshots and full results/logs:

- [Desktop All Trips search controls](../evidence/search-browser/desktop-controls.jpg)
- [Mobile All Trips search controls](../evidence/search-browser/mobile-controls.jpg)
- [Assertion results](../evidence/search-browser/browser-results.json)
- [Browser run log](../evidence/search-browser/browser-run.log)
- [API regression log](../evidence/search-browser/final-api-regression.log)
- [TypeScript check log](../evidence/search-browser/final-typecheck.log)
- [Search unit-test log](../evidence/search-browser/final-feature9-unit-tests.log)
- [API build log](../evidence/search-browser/final-build-api.log)
- [Web build log](../evidence/search-browser/final-build-trip-log.log)

The owner confirmed Feature 8 production verification before authorizing this
feature. A separate read-only production probe found a healthy deployment,
Feature 8 bundle markers, and authentication-required responses from the
starred API; the authenticated Feature 9 browser tests above are Development
tests, not production verification.
