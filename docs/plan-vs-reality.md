# Plan vs. Reality — implementation record

The approved `PLAN.md` remains frozen. This separate record supplies its requested
delivery table without changing the plan or writing the owner's academic reflection.
Features 1–9 were owner-merged/published; the owner confirmed Feature 9's production
verification before Dashboard began. Feature 10 is implemented and locally verified,
but still requires owner review, merge, Publish and production verification.

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
| 10. Dashboard | Implemented and verified; unmerged | Done (implementation; owner delivery pending) | Independent aggregate grains and calendar-date arithmetic prevent incorrect totals. | New authenticated aggregate read API; responsive metrics and monthly table, no schema/dependency changes. |

No original feature was cut. Optional map enhancements/geocoding/flight routes are
outside this PR. Hosting resources, authentication configuration and production data
were not modified.
