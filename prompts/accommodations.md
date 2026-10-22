# Feature 7 — Accommodations prompt log

Date: October 22, 2026
Issue: #15 — https://github.com/yukobayashi0811/trip-log/issues/15
Branch: `feature/accommodations`, created from the verified latest `main` commit.

## Original request

I've completed the Feature 6 production checkpoint: road routing works on the published Trip Log application.

Please verify that PR #14 (Feature 6: Road-based route builder) is merged into the latest `main` branch and that production is healthy. If the PR is not merged or the production prerequisite is not satisfied, stop and report the blocker before starting development.

Proceed with **Feature 7: Accommodations**, following the approved `PLAN.md` and existing `schema.md`.

## 1. Feature requirements

Implement accommodation management using the existing `stays` table and its relationship to `stops`.

Users should be able to:

- Add accommodation information to a stop within one of their trips.
- Choose one of the approved accommodation types:
  - Hotel
  - Campground
  - Vacation Rental
  - Other
- Enter a check-in date and check-out date.
- Optionally enter a rating (1–5) and notes.
- View accommodation details on the trip itinerary, trip detail page, and map experience as appropriate.
- Edit or delete an existing accommodation record.
- Easily distinguish overnight stays from ordinary sightseeing or restaurant stops.

Reuse the existing stop's name and coordinates to identify the accommodation location. Do not introduce a separate accommodation-location database model.

Respect the approved **one stay per stop** relationship. A trip may contain multiple accommodation stops, each with its own stay.

## 2. Data model and validation

Use the existing PostgreSQL/Drizzle schema:

- `stays.id`
- `stays.stop_id`
- `stays.accommodation_type`
- `stays.check_in`
- `stays.check_out`
- `stays.rating` (optional)
- `stays.notes` (optional)

Requirements:

- `check_out` must be later than `check_in`.
- Allow only the four approved accommodation types.
- Rating must be an integer from 1 to 5 when provided.
- Reject duplicate stays for the same stop, using the existing database uniqueness constraint.
- Provide clear frontend and backend validation errors.
- Preserve entered form values when validation fails.
- Ensure deleting a stay does not delete its stop or trip.
- Respect the existing cascade behavior when a stop or trip is deleted.
- If a stop has an associated stay, make the consequences clear in its deletion confirmation.
- Do not add artificial limits on the number of accommodation stops in a trip.
- Do not add new date restrictions beyond the approved schema without discussing them first.

Avoid database migrations unless strictly necessary. The approved schema already supports this feature.

## 3. Authentication and ownership

Every accommodation operation must enforce server-side ownership through the authenticated user's parent trip and stop.

A user must not be able to read, create, modify, or delete a stay attached to another user's stop, even when they know its UUID.

Check cross-trip and cross-user UUID substitution, unauthenticated access, duplicate creation, and failed writes.

Never trust client-supplied ownership information.

## 4. UI and integration

Integrate accommodation management into the existing Trip Log experience rather than building an unrelated page.

- Provide an intuitive way to add a stay from a selected stop.
- Show the accommodation type, check-in/check-out dates, and optional rating and notes.
- Distinguish accommodation stops from regular itinerary stops without obscuring marker order or road routes.
- Preserve the existing Leaflet map, stop CRUD, ordering, and ORS routing.
- Make the accommodation forms and details usable on desktop and mobile.
- Support loading, empty, success, validation, and error states.
- Confirm destructive actions where appropriate.
- Do not introduce unnecessary packages or paid third-party services.

Keep the UI consistent with the existing design system.

## 5. Testing and verification

Add real backend integration tests covering:

- Accommodation creation, retrieval, editing, and deletion.
- One-stay-per-stop uniqueness.
- Valid and invalid accommodation types, dates, ratings, and notes.
- Cross-user and cross-trip ownership protection.
- Preservation of existing records after invalid operations.
- Cascade deletion behavior.
- Multiple different accommodation stops within the same trip.

Run the complete existing regression suite, workspace TypeScript checks, and frontend/API production builds.

Perform actual browser interaction tests on desktop and mobile, including adding, editing, and deleting a stay and confirming persistence after reload.

Where appropriate, extend the existing ownership-isolation red/green evidence using a genuine controlled defect. Save actual results and screenshots; do not fabricate evidence or leave intentional defects in the final code.

Document any outstanding limitations honestly.

## 6. Scope boundaries

Implement Feature 7 only.

Do not implement:

- Feature 8: Stars
- Feature 9: Search / Filter / Sort
- Feature 10: Dashboard
- Place-name search or geocoding
- Dashed great-circle flight routes
- Hotel reservations or external booking APIs
- Expense tracking, photo galleries, or unrelated enhancements

Place-name search and dashed flight paths are separately approved future enhancements. Keep them outside this PR.

Do not modify the approved `PLAN.md`. It will be reconciled later in the final Plan vs. Reality section.

## 7. GitHub workflow

Follow the established one-feature-per-PR process:

1. Verify the latest merged `main` and the Feature 6 production checkpoint.
2. Create a GitHub Issue for Feature 7.
3. Create `feature/accommodations` from the latest `main`.
4. Implement the feature with tests.
5. Record the actual prompts, development decisions, and issues in `prompts/accommodations.md`.
6. Update `README.md`, `schema.md` if necessary, and other relevant documentation.
7. Open a PR linked to the new Issue using `Closes #N`.

Do not commit directly to `main`, auto-merge, merge the PR yourself, or publish unmerged changes.

## 8. Cost and deployment controls

Use the existing stack and avoid unnecessary dependencies.

Keep the current Replit Autoscale configuration unchanged:

- 1 vCPU
- 1.0 GiB RAM
- Maximum 1 machine

Do not enable paid services, change the hosting allocation, or incur additional expenses without approval.

**Stop when the Feature 7 PR is ready for my review. Do not start Feature 8.**

## Implementation decisions

- Reused the existing `stays` table and `stops` foreign key; no schema or migration change.
- Used nested `/trips/:tripId/stops/:stopId/stay` CRUD routes. Every operation locks and verifies the signed-in user's parent trip and the stop's membership in that trip before accessing a stay.
- Added `stay: null | Stay` to all stop responses so the existing map itinerary and trip detail views can display the same relationship without an extra request per stop.
- Shared one date/type/rating validation schema between the browser and API. It checks real calendar dates and `check-out > check-in`; it does not compare stay dates to trip dates or impose past/future limits.
- Preserved nonblank notes exactly, matching the existing trip/stop note behavior; whitespace-only optional notes become `null`.
- Existing uniqueness and cascade constraints remain the final database safeguards. The stay delete operation removes only the stay; stop deletion confirmation states that an attached stay is also deleted.
- No packages, paid services, production writes, deployment settings, or Autoscale resources were added or changed.

## Development issues and resolutions

- OpenAPI code generation caught an incorrectly placed duplicate `delete` mapping and unquoted comma-containing flow-map descriptions. Both were corrected before generated client code was used.
- The shared Zod 3 enum does not allow `required_error` alongside a custom `errorMap`; the enum uses one actionable error map for both missing and unsupported values.
- The first notes assertion expected nonblank outer whitespace to be removed. It was corrected to test preservation of the entered text; blank-only notes still normalize to `null`.

## Verification outcome

- The post-Feature-6 production prerequisite passed before the feature branch work began; details are in `docs/accommodation-verification.md`.
- `pnpm --filter @workspace/api-server test`: 240 tests passed after follow-up fixes. `pnpm run typecheck` and OpenAPI code generation passed.
- `PORT=21377 BASE_PATH=/ pnpm run build` passed for the frontend and API. Vite reported a source-map warning for `tooltip.tsx` and the existing bundle-size advisory.
- A controlled removal of the stay parent-trip owner predicate produced a real red isolation test (`expected 200 to be 404`); restoring the predicate produced a green focused test. Raw output, UTC times, source hashes and screenshots are in `evidence/tests/`.
- The authenticated desktop/mobile UI workflow has not been exercised: the available Preview capture is signed-out and non-interactive, and no authorized isolated test identity helper is available in this workspace. No credentials were inspected and no unmerged code was deployed.
- No schema migration, `PLAN.md` edit, paid service, production write or Autoscale change was made.
- Pull Request #16 is open for review: https://github.com/yukobayashi0811/trip-log/pull/16

## Follow-up verification request (verbatim)

```text
Please complete the outstanding Feature 7 verification before I merge PR #16.

I reviewed the code and identified a possible UI state issue: `StayPanel` retains local editing state when the selected stop changes. Ensure unsaved accommodation values cannot carry over from Stop A to Stop B or accidentally be saved to the wrong stop. Prefer appropriate unsaved-change protection, and add regression coverage.

Also check that stay date validation rejects year `0000` cleanly rather than allowing a database error.

Then perform genuine authenticated browser tests of accommodation creation, editing, deletion, and persistence after reload, on both desktop and mobile.

Use the development Preview with an authorized, isolated test identity. Follow the established development-only browser testing approach where supported; do not bypass production authentication, inspect credentials, or modify production data. If authenticated testing is still unavailable, report that limitation explicitly rather than claiming success.

Test switching stops while an accommodation form has unsaved changes, and verify that deleting an accommodation preserves its Stop and existing road routes.

Rerun the complete API regression suite, TypeScript checks, and production builds after any fixes. Add the actual browser evidence and results to `docs/accommodation-verification.md` and the existing PR #16.

Do not merge, publish, change PLAN.md or Autoscale settings, or start Feature 8. Stop for my review.
```

## Follow-up outcome

- Prevented stay form state from crossing stop selections and added shared draft-state regression tests.
- Added year-0000 validation and verified stay deletion leaves the stop and route result unchanged.
- Full regression: 240 tests passed; TypeScript checks and production builds passed.
- Authenticated desktop/mobile browser CRUD and switching tests remain unverified because no supported authorized development test identity/browser helper was available. See `docs/accommodation-verification.md`; no browser CRUD evidence is claimed.
