Please proceed with **Feature 8: Stars / Favorite Trips**, following the approved `PLAN.md`, `schema.md`, and established Trip Log development workflow.

Use **Replit Agent Free Mode** for this feature.

## 0. Prerequisites

Before implementation:

- Verify that Feature 7 PR #16 and publishing hotfix PR #18 are merged into the latest `main`.
- Verify the published Trip Log application is healthy.
- Confirm the Feature 7 production checkpoint: authenticated accommodation creation, viewing, editing, deletion, and persistence work in production.

If the production checkpoint has not been confirmed, report what remains and stop before starting Feature 8.

Do not modify production data during prerequisite checks.

## 1. Feature requirements

Implement the approved Feature 8 user story:

"As a traveler, I want to star/unstar my own trips and view a dedicated favorites page so that I can revisit them easily."

Users should be able to:

- Star a trip they own.
- Remove a star from a previously starred trip.
- Clearly distinguish starred and unstarred trips.
- See and change the star state on the trip detail page.
- See star status and conveniently toggle it in the existing All Trips experience.
- Open a dedicated **Starred Trips** page containing only their own starred trips.
- Open a trip directly from that favorites page.
- See an appropriate empty state when no trips are starred.
- Retain star state after page reload and sign-out/sign-in.

Use a consistent, accessible star icon and clear button labels such as "Star trip" and "Remove star".

Do not add social sharing, public favorites, recommendations, or a separate rating system.

## 2. Database and API

Reuse the existing `stars` table:

- `user_id`: foreign key to `users.id`
- `trip_id`: foreign key to `trips.id`
- `created_at`: timestamp
- Composite primary key: `(user_id, trip_id)`

Requirements:

- Do not create another favorites table.
- Do not change the approved schema or add a migration unless absolutely necessary.
- Enforce one star per user-trip pair using the existing database constraint.
- Ensure star/unstar operations cannot create duplicate records.
- Deleting a trip must remove its associated star through the existing cascade behavior.
- Never create or delete a trip as a side effect of starring or unstarring it.
- Persist stars in PostgreSQL, not only in browser state or local storage.

Add the necessary authenticated API endpoints following existing Express, Drizzle, OpenAPI, generated client, and Zod conventions.

Use appropriate HTTP status codes and deterministic behavior for repeated star/unstar requests.

Keep the implementation minimal and consistent with existing API patterns.

## 3. Security and ownership

**Every star operation must verify the authenticated user's ownership of the trip on the server.**

A user must never be able to star, unstar, inspect, or list another user's private trip.

Requirements:

- Derive the user identity exclusively from the authenticated server-side session.
- Do not trust user IDs supplied in request bodies, query parameters, or headers.
- Verify trip ownership before creating or deleting a star.
- Ensure the Starred Trips page and API return only the authenticated user's own trips.
- Deny unauthenticated requests.
- Return consistent not-found behavior for nonexistent and unowned trip IDs.
- Do not leak another user's trip title, coordinates, notes, or star status.
- Preserve existing trip and star records after denied operations.

Be careful: the composite primary key and foreign keys enforce relational integrity, but they are not substitutes for authorization.

## 4. Frontend integration

Integrate the feature into the existing Trip Log design.

### Trip detail

- Display a clearly identifiable star/unstar control.
- Show the correct saved state when the page loads.
- Update the UI after a successful toggle.
- Handle failed requests without displaying a false saved state.

### All Trips

- Indicate which trips are starred.
- Allow users to toggle stars conveniently.
- Preserve existing trip CRUD and navigation behavior.

### Starred Trips page

- Implement the dedicated favorites page already specified in PLAN.md.
- List only the current user's starred trips.
- Allow navigation to each trip.
- Include a useful empty state with a link to All Trips.
- Match the existing responsive layout and visual style.

### General UI requirements

- Work on desktop and mobile.
- Provide clear loading and error states.
- Ensure keyboard accessibility, accessible labels, and visible focus states.
- Keep star state synchronized across the Trip Detail, All Trips, and Starred Trips views.
- Prevent duplicate requests or confusing UI behavior from rapid repeated clicks.
- Avoid exposing previously authenticated users' cached favorites after logout or account switching.

Do not redesign the app or introduce unnecessary dependencies.

## 5. Testing

Add real backend integration tests against the existing PostgreSQL test environment.

Test at least:

1. Star an owned trip successfully.
2. Remove a star successfully.
3. Repeated star/unstar requests behave predictably without duplicate database rows.
4. A starred trip appears on the owner's favorites page.
5. An unstarred trip disappears from that page.
6. A user with no starred trips receives an empty result.
7. User B cannot star, unstar, or access User A's private trip, even with a known UUID.
8. Unauthenticated and forged-identity requests are denied.
9. Deleting a trip cascades to its star record.
10. Invalid or unknown trip IDs do not change saved records.
11. Multiple trips and multiple users remain properly isolated.

Extend **Test A (Data Isolation)** with a genuine controlled red/green test for star ownership:

- First establish a passing test.
- Introduce a narrowly controlled authorization defect in the test environment.
- Capture the actual failing test, exit code, and output.
- Restore the original code.
- Capture the passing result using the same targeted test.
- Save the genuine screenshots, raw logs, defect diff, and explanation in `evidence/tests/`.

Do not fabricate test results or leave the controlled defect in the final implementation.

Run:

- The complete API regression suite.
- Workspace TypeScript checks.
- OpenAPI generation as required.
- Frontend and API production builds.

## 6. Browser verification

Perform genuine authenticated browser tests in the development environment where access is available.

Verify:

- Star a trip from All Trips.
- Confirm it appears in Starred Trips.
- Open its detail page and confirm the star state is consistent.
- Reload and verify persistence.
- Unstar it and confirm it disappears from favorites.
- Verify the empty state.
- Check desktop and mobile layouts.
- Verify existing trip CRUD, stops, accommodations, and road routes remain unaffected.

Use a safe, isolated development test account and synthetic records when possible.

Do not bypass Clerk authentication or use production credentials.

If authenticated browser testing is unavailable, document the limitation honestly and provide a precise manual verification checklist. Do not claim browser verification passed based only on automated API tests.

## 7. Scope boundaries

Implement **Feature 8 only**.

Do not implement:

- Feature 9: Search / Filter / Sort
- Feature 10: Dashboard
- Place-name search or geocoding
- Dashed Flying routes
- Hotel or restaurant reviews
- Public or shared favorite lists
- Social features, booking APIs, or additional paid services

The planned favorites page is part of Feature 8, but title/region/year/starred filtering of the full trip collection belongs to Feature 9.

Do not modify the original `PLAN.md`. Additional enhancements remain separate from the approved initial feature plan.

## 8. GitHub workflow

Follow the established one-feature-per-PR process:

1. Verify prerequisites and the latest merged `main`.
2. Create a new GitHub Issue for Feature 8.
3. Create `feature/stars` from the latest `main`.
4. Implement Feature 8 only.
5. Save the actual user prompt and development decisions in `prompts/stars.md`.
6. Add tests, evidence, and verification documentation.
7. Update the README and schema documentation where necessary.
8. Open a PR linked to the new Issue with `Closes #N`.

Never commit directly to `main`.

Do not automatically merge, publish, or begin Feature 9.

## 9. Cost and deployment controls

Avoid unnecessary dependencies, new services, and paid APIs.

Keep existing Replit Autoscale resources unchanged:

- 1 vCPU
- 1.0 GiB RAM
- Maximum 1 machine

Do not modify the publishing-build hotfix unless a genuine issue is discovered.

**Stop once the Feature 8 PR is ready for my review. Do not merge or publish it yourself.**

## Development decisions

- Confirmed the production Feature 7 accommodation checkpoint before starting; PR #16 and publishing hotfix PR #18 were merged.
- Kept the existing five-table schema unchanged. Implemented private owner-scoped GET /api/starred-trips and idempotent PUT/DELETE /api/trips/:tripId/star operations; trip ownership is checked and row-locked server-side before mutation.
- Kept starred trip retrieval as its own generated OpenAPI/client query rather than changing the shared Trip response shape. The All Trips, detail, and Starred Trips views share a user-keyed cache entry; account changes continue to clear the query cache.
- Scoped authentication middleware to only the three star routes so the new router does not add extra account synchronization to unrelated APIs.
- The authenticated browser workflow was not available in the signed-out browser environment; no Clerk authentication was bypassed. Manual verification steps are recorded in docs/stars-verification.md.