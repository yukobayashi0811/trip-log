# Plan vs. Reality — implementation record

The original planning requirements remain unchanged. This record supplies the
assignment's delivery table without adding an academic reflection. Features 1–10
are complete and merged. The owner confirmed the PR #28 first-stop improvement was
published and verified in production; this does not claim new per-feature production
checks beyond the evidence already recorded in each verification document.

| Planned feature | Shipped / Changed / Cut | Status (Done/Backlogged) | Learning | What changed and why (one line) |
|---|---|---|---|---|
| 1. Accounts | Shipped | Done | Authenticated user data must be exercised, not just login. | Existing Replit-managed Clerk foundation retained. |
| 2. Relational database | Shipped | Done | Parent ownership remains an API responsibility. | Approved five-table schema retained. |
| 3. Trip CRUD | Shipped | Done | Cross-account tests must verify records survive denied writes. | Owner-scoped create/list/detail/edit/delete delivered. |
| 4. Validation | Shipped | Done | Calendar dates need more than a date-shaped regex. | Shared validation extended rather than duplicated. |
| 5. Interactive map/stops | Shipped | Done | Stops need transactional ordering and parent ownership. | Named manual-coordinate stops shipped; geocoding enhancements are separate. |
| 6. Road routing | Shipped | Done | Provider failures must never alter saved stops. | Estimated road routes retained; no flight geometry added. |
| 7. Accommodations | Shipped | Done | Local edit state must belong to the selected stop. | One existing stay per stop; no new schema. |
| 8. Stars | Shipped | Done | Failed requests cannot be reported as successful favorites. | Existing stars table and private favorites page reused. |
| 9. Search/filter/sort | Shipped | Done | Evidence must identify the tested application source precisely. | Existing owner-scoped APIs support combined client-side filters. |
| 10. Dashboard | Shipped | Done | Independent aggregate grains and calendar-date arithmetic prevent incorrect totals. | New authenticated aggregate read API; responsive metrics and monthly breakdown, no schema/dependency changes. |
| Stranger Test — first-stop action | Shipped | Done | The Stranger Test identified difficulty finding how to add the first stop after creating a trip. | Added a direct action from the successful zero-stop state to the existing map/stop workflow; other findings were left unchanged. |

No original feature was cut. Optional map enhancements/geocoding/flight routes are
outside this PR. Hosting resources, authentication configuration and production data
were not modified.
