# Feature 6 — actual request and decisions

## Owner request (verbatim)

> I've personally merged PR #12 (Feature 5: Interactive Map), republished Trip Log, and verified the core map and stop-management interactions in production.
>
> Please verify the latest `main` branch and production health, then proceed with **Feature 6: Road-Based Route Builder**, following the approved PLAN.md.
>
> ## Scope
>
> - Use openrouteservice Standard Free to calculate estimated road-following routes between ordered stops connected by `Driving`.
> - Use the current ORS endpoint: `https://api.heigit.org/openrouteservice/v2/directions/driving-car/geojson`.
> - Keep `ORS_API_KEY` server-side in Replit Secrets. Never expose or log the key, commit it, or put it in prompt files.
> - If the secret is missing, report exactly what I need to configure rather than inventing a key or using a paid service.
> - Respect the GeoJSON coordinate order `[longitude, latitude]`.
> - Support intermediate stops and journeys that return to their starting location when represented by the recorded itinerary.
> - Display routes on the existing Leaflet map and clearly label them "Estimated Driving Route".
> - Only connect appropriate consecutive Driving segments. Do not draw road routes across Flying or Other transitions.
> - Preserve stop markers, ordering, and saved data even when routing is unavailable.
> - Handle unreachable locations, timeouts, invalid responses, rate limits, and quota exhaustion gracefully.
> - Avoid redundant requests through appropriate debouncing and request deduplication. Respect provider usage limits and licensing requirements.
>
> ## Flying and future enhancements
>
> For this feature, stops marked `Flying` or `Other` should remain visible without connecting route lines.
>
> We have separately approved a **future enhancement** to display Flying segments as dashed great-circle paths, calculated locally without an additional API. Do not implement it in Feature 6.
>
> A second future enhancement will add place-name search for faster stop creation. Do not implement geocoding or place search in this PR.
>
> Keep both enhancements separate from the original PLAN.md and the Feature 6 PR.
>
> ## Testing
>
> - Test ordered driving routes, intermediate stops, return journeys, mixed transport modes, and route recalculation after stop changes.
> - Test missing API keys, provider errors, timeouts, and rate limits using controlled mocks where appropriate.
> - Verify authenticated trip ownership and no leakage of API secrets.
> - Test actual route rendering in the development browser with a real ORS response when the configured key permits it.
> - Run all existing regressions, TypeScript checks, and production builds.
> - Document actual verification results, provider limits, and any outstanding issues.
>
> ## GitHub and cost controls
>
> Create a new Feature 6 Issue and a `feature/routing` branch from the latest main. Save actual prompts and decisions in `prompts/routing.md`, update relevant documentation, and open a PR linking its Issue with `closes #N`.
>
> Do not modify the original PLAN.md, commit directly to `main`, deploy unmerged changes, or begin Feature 7.
>
> Keep the existing Autoscale allocation: 1 vCPU, 1.0 GiB RAM, maximum one machine. Do not introduce paid services or increase resources without my approval.
>
> **Stop for my review when the Feature 6 PR is ready. Do not merge it yourself.**

## Actual checkpoints and decisions

- Verified PR12 merge/main, successful public production build and live
  landing/health/Clerk200 plus unauthenticated trips401. Signed-in map verification
  is explicitly owner-confirmed.
- Created Issue13 and `feature/routing` from latest main. Original PLAN hash
  matched main. No GitHub main commit, publish or resource/service activation.
- Checked key **existence only** in development and production: absent.
  Integration search did not provide ORS; used the specifically approved direct
  ORS Standard Free API, not a substitute paid maps service.
- During browser verification the owner added ORS_API_KEY. Existence checks then
  returned true for both environments. Restarted the API workflow to load it
  and instructed the same tester to perform real-provider rendering without
  interception, rather than retaining the now-obsolete missing-key-only gap.
- Checked official current plans/restrictions/terms:2,000/day,40/minute,
  50waypoints,6,000km normal driving, CC-BY-SA4.0 and HeiGIT/OSM attribution.
- Contract-first owned saved-itinerary GET, generated client/Zod; no request-body
  coordinates or server-owned identity from client. No schema change.
- Shared deterministic revision and Driving-arrival run builder. Preserve
  intermediate/return points; chunk with overlapping boundary for provider50.
- Strict numeric GeoJSON/summary allowlist and bounded reads. Never return/log
  raw provider exception/body/metadata/query that may carry credentials.
- Transient scoped cache/in-flight dedup,650ms client debounce, no focus polling
  or automatic retries, conservative rolling budgets, global429 cooldown,
  bounded concurrency and timeout. No persistent geometry/paid fallback.
- Preserve the existing map/CRUD layout, adding road paths and an availability
  panel rather than another page or design-system prerequisite.

## Actual verification

- Initial42 targeted tests passed. Typecheck found the generated query-key
  helper name mismatch; corrected to the actual generated export.
- Extended coverage to response bytes, cache bounds, concurrency and daily
  budget. Full225/9-file regression suite passed; full workspace TypeScript and
  frontend/API production builds passed.
- Controlled ownership defect genuinely yielded unauthorized200/expected404,
  exit1. Restored original source hash and same targeted test passed1/7skipped.
  Captured actual log screenshots; removed temporary HTML renderers.
- Browser test brief (summary, not quoted user instruction): explicitly synthetic
  Clerk identity, saved intermediate/return/mixed-mode itinerary, actual missing
  key state first; controlled response interception for road rendering,
  recalculation, cache and cooldown; desktop/mobile; scoped fixture cleanup and
  sign-out before internal-account cleanup. Never claim mocked roads are real ORS.
- First programmatic login attempt was rejected422 because the helper rejected
  `.invalid` email domains; no data was created. Main authorized a unique
  reserved `example.com` synthetic address and continued the same tester.
- Actual desktop/mobile pass verified the real initial missing-key response,
  controlled rendering/revision/cooldown behavior and then genuine ORS200
  geometry after secret setup: two ready sections,3.3km/about8min, no Flying gap.
  Real intermediate/return geometry had65 vertices plus a separate17-vertex
  section. Browser interceptions were removed before this actual GET.
- Browser found a Leaflet class/hover assertion failure: pathOptions styling did
  not install the class on an SVG path. Moved it to the top-level Polyline option,
  added accessible labeling, rechecked frontend types/build, and asked the same
  tester to check only that corrected interactive flow and a small real A/B/A
  route. No broad second lifecycle or next-feature work.
- Focused recheck passed: one real GET200,29vertices,1,585.8m/192.4s with matching
  snapped start/end. Correct SVG class/role/label verified. Tooltip appeared
  via dispatched mouseover; actual pointer hover was inconclusive, explicitly
  retained as a capture limitation rather than reported as passed.
- Both synthetic trips removed and helper signed out. Removed only the actual
  proven-new empty internal account, preserving all four baseline accounts and
  leaving the unrelated remaining trip/stop untouched.
- Workspace restart removed the temporary GitHub checkout before the push.
  Saved source/evidence remained intact. Recreated the same branch from verified
  latest main in an ignored workspace checkout and restored development
  workflows. No production publish or main commit was performed.

Detailed results, evidence, provider restrictions, limitations and exact secret
setup instructions are in `docs/routing-verification.md`. No key value belongs
in this log. Real-provider verification is distinct from the controlled mocks.
