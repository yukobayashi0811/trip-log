# Feature 5 — Actual owner request

The following is the owner's attached request, preserved as supplied:

> I've personally merged PR #10 (Feature 4: Validation), republished Trip Log, and verified that the updated validation works in production.
>
> Please verify the latest `main` branch and production health, then proceed with **Feature 5: Interactive Travel Map**, following the approved PLAN.md.
>
> ## 1. Feature requirements
>
> Implement the planned trip map and stop-management functionality:
>
> - Display an interactive Leaflet map using OpenStreetMap tiles.
> - Let users select an existing trip and view its geographic stops as markers.
> - Let users click the map to choose coordinates and add a named stop.
> - Allow stop creation, editing, deletion, and reordering.
> - Display stops in itinerary order alongside the map.
> - Store latitude, longitude, sort order, optional visit date, stop type, transport from previous stop, and notes using the existing database schema.
> - Keep the map and itinerary synchronized when stops change.
> - Provide useful loading, empty, validation, and error states.
> - Support desktop and mobile layouts, including a usable collapsible itinerary on narrow screens.
>
> ## 2. Data protection and validation
>
> - Every stop operation must enforce authenticated ownership of its parent trip on the server.
> - Users must not access or change stops belonging to another user's trip, even when they know its UUID.
> - Validate coordinate ranges, stop names, dates, sort order, and permitted transport types.
> - Ensure stop reordering updates the database reliably and deterministically.
> - Preserve existing trips and all Feature 1–4 functionality.
>
> ## 3. Scope boundaries
>
> Do not implement road-based routing, openrouteservice API calls, accommodation management, stars, search, or dashboard features yet.
>
> Straight lines between markers are not actual road routes. Do not present them as driving routes. Road-following routes belong to Feature 6.
>
> Reuse the approved React/TypeScript, Express, Drizzle, Leaflet, and OpenStreetMap architecture. Avoid unnecessary dependencies and paid services.
>
> ## 4. Verification
>
> - Add real backend integration tests for stop CRUD, ordering, invalid coordinates, and user isolation.
> - Test the actual map interactions in the development browser.
> - Check both desktop and mobile usability.
> - Run the full regression suite, TypeScript checks, and production builds.
> - Document genuine results and any limitations.
>
> ## 5. GitHub workflow
>
> Follow the established process:
>
> 1. Create a Feature 5 GitHub Issue.
> 2. Create `feature/map` from the latest `main`.
> 3. Implement and test the feature.
> 4. Record actual prompts and decisions in `prompts/map.md`.
> 5. Update relevant documentation.
> 6. Open a Pull Request linked with `closes #N`.
>
> Keep the approved PLAN.md unchanged.
>
> Do not commit directly to `main`, merge the PR, or deploy unmerged changes.
>
> Keep the existing Autoscale configuration at 1 vCPU, 1.0 GiB RAM, and maximum one machine. Do not activate paid services or increase resource limits without my approval.
>
> **Stop when the Feature 5 PR is ready for my review. Do not begin Feature 6.**

## Actual decisions and delegated briefs

- Verified PR #10 merged, read latest main, checked live deployment success/
  health200 and private trip401. Accepted owner's production validation
  confirmation; did not borrow a production session.
- Created Issue #11 and `feature/map` from that latest main.
- Main agent implemented API/OpenAPI/shared validation, real integration tests,
  concurrency/ownership protection, evidence and documentation.
- Used existing stops schema; no migrations. One owned-parent transaction lock
  serializes mutations; exact complete-ID permutations and deterministic UUID
  tie-break resolve ordering. UI creates append and edit preserves position.
- Strict finite numeric coordinate inputs, six-decimal storage, date-only
  calendar validation, matching existing Driving/Flying/Other transport modes.
- Added only Leaflet 1.9.4, React Leaflet 5.0.0, and Leaflet type declarations
  (plus required transitive dependencies). No commercial tile/routing service.
- OpenAPI codegen initially exposed an inline request-body value/type naming
  collision. Fixed the contract to reference named `StopOrderInput`, regenerated
  successfully, rather than editing generated output.
- Frontend design helper brief: existing personal travel journal, protected
  `/map`/trip map routes, all generated stop hooks, numbered real markers and
  map-click stops, full fields, synchronized itinerary/selection, desktop and
  mobile collapsible layout, shared validation, dirty-form protection, real
  empty/loading/error states; no emoji/fake records/future features/paid services.
  Existing auth/theme and trip UI must remain intact. Helper changed frontend
  files only; main reviewed/fixed narrow navigation, in-app draft guard,
  pending selection and create/refetch selection timing.
- Main verified all 178 tests, TypeScript, frontend/API production builds.
- Extended required Test A with an actual controlled parent-owner omission,
  real failed run, exact restoration and passed run. Saved raw logs and genuine
  browser screenshots of their captured output; removed temporary display pages.
- Browser testing helper brief: explicitly override Clerk programmatic claims,
  record actual `/api/auth/me` internal UUID for provenance; no UI password/
  bypass/production. Real desktop and mobile map click/create/edit/relocate/
  reorder/reload/selection/collapse/delete, field validation and dirty-switch
  guards; observe actual API statuses and OSM tiles; clean only synthetic trips.
  Main captured a pre-login user-ID baseline for safe internal account cleanup.

Briefs above are labeled summaries, not fabricated verbatim helper transcripts.
Actual results and limitations are recorded in `docs/map-verification.md`.
No production mutation, publishing, resource change, merge or Feature 6 work.

## Actual browser outcome and focused correction

The desktop/mobile map journey succeeded with real OSM200 responses, actual
click-created stops, validation feedback, edit/reload persistence, order200,
mobile create201, delete204, discard guards and tile-error recovery.
The first create and edit HTTP statuses were not captured by the listener;
these are explicitly reported as gaps rather than invented.

The browser found an old popup remaining open after itinerary selection.
Main corrected selection-driven Leaflet popup open/close, then rechecked
frontend typecheck/build. The same testing helper was asked to recheck only
marker A → itinerary B → marker A, not the entire lifecycle. It passed after
the brief popup transition settled; the helper cleaned its temporary trip.
All testing trips and only the proven-new internal test account were removed;
the four pre-login baseline accounts were preserved.
