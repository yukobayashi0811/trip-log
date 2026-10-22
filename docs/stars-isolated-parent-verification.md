# Feature 8 — isolated parent integration verification

## Scope and preserved work

The tested implementation is PR #20's exact commit
`dff12a83086f02a0f9982d1b1988f68960a7655e`. No Feature 8 application source
was recreated, edited, merged, or deployed during this verification.

The shared workspace remains on `feature/accommodations`, clean, at
`539d151583d2f84ea812ec0029f6eff8870f9dc3`: eight local commits ahead of its
remote tracking branch. The attachment described seven commits; the extra
commit is the subsequent Replit setup checkpoint. The original seven-commit
tip remains an ancestor.

The attachment's named backup ref was absent on inspection. It was created
only if absent, without replacing an existing ref:

- `backup/feature-accommodations-before-stars`:
  `cf57b47774da426fbe8717399b6078d79bf6c4c0`
- `backup/feature-accommodations-before-isolated-stars`:
  `539d151583d2f84ea812ec0029f6eff8870f9dc3`

The `.replit` and post-merge script changes are now part of the latest
checkpoint, not uncommitted edits. No root branch switch, reset, clean,
force-push, application-file replacement, or shared workflow change occurred.

## Task coordination and visibility

The available task status updates identified these three items:

| Item | Latest visible status | Environment and coordination |
| --- | --- | --- |
| Catch failed star requests before they mislead users | In progress | The child's filesystem, uncommitted changes, and current local commits are not mounted in the parent. They were not assumed clean, changed, stopped, cancelled, or merged. No child Git-authentication commands were invoked by the parent. |
| Finish Starred Trips checks with an authorized Development test account | Previously queued; no longer active in the latest platform update | There was no running worktree for this item visible in the parent. This parent sandbox now supplies genuine authenticated browser evidence for that verification scope. |
| Verify starred trips in production after PR review | Previously queued; no longer active in the latest platform update | Production verification remains a later checkpoint, after owner-approved merge and publishing. It was not performed here. |

The parent did not cancel either prior follow-up. No active child filesystem
was accessible for a reliable per-child dirty-state inspection; that is a
visibility limit, not a claim that the child has no local work.

The parent-visible Trip Log web server, API server, and mockup-sandbox server
all run from the shared workspace. Changing that checkout could disrupt them.
They were left untouched. The sandbox below does not use their processes,
ports, database, or Preview.

## Exact isolated checkout and runtime

The old ignored `generated-artifacts/feature-stars` directory had no Git
metadata and was not used as application source. The required PR commit
object was absent from the main repository.

A new independent Git repository was created outside the shared workspace.
Local objects were copied without hardlinks. The authorized GitHub App
connection supplied the missing commit, trees, and blobs through GitHub's Git
Data API. Every imported object's Git hash, the final commit SHA, tree
connectivity, and clean checked-out status were verified. No CLI network
authentication or credentials were extracted, printed, or embedded.

- Checkout: `/tmp/trip-log-pr20.pCOOWv/repo`
- Branch: `preview/feature-stars`, exact tested commit above
- Frontend: dedicated port `23451`
- API: dedicated port `23452`
- Database: separate local PostgreSQL cluster, private Unix socket,
  data directory under `/tmp/trip-log-pr20.pCOOWv`; socket port `25432`

This is a temporary parent-owned development sandbox, not a published app.
It was launched and tested successfully, then parked: its three temporary
processes were stopped, while its exact checkout, empty database, and evidence
remain available for Agent-managed reuse. Replit's port scanner automatically
added mappings for the two temporary listeners; only those two mappings were
removed after stopping the temporary processes, restoring the original shared
configuration. The shared project Preview was never replaced. No project
environment variables, production data, managed project database tables,
Autoscale resources, or `PLAN.md` were changed.

## Automated results

All checks used the isolated checkout and local database:

| Check | Result |
| --- | --- |
| Frozen-lockfile dependency install | Passed |
| Schema initialization in the empty local database | Passed |
| Complete API regression suite | **248 tests passed, 12 files** |
| OpenAPI code generation | Passed; tracked source remained unchanged |
| Workspace TypeScript checks | Passed |
| API artifact production build command | Passed |
| Frontend artifact production build command | Passed |

The existing nonfatal tooltip sourcemap and Vite chunk-size warnings remain.
Raw [API test output](../evidence/stars-parent/api-regression.log),
[TypeScript output](../evidence/stars-parent/typecheck.log), and
[API](../evidence/stars-parent/build-api-server.log) /
[frontend](../evidence/stars-parent/build-trip-log.log) build logs are retained.

## Genuine authenticated browser results

Chromium ran against the separate frontend/API ports at desktop 1280×900 and
mobile 390×844. Two synthetic users were created only in the Clerk
**Development** instance. A Development-key guard prevented using a live key.
Clerk-issued, short-lived, single-use sign-in tickets established real Clerk
sessions; authentication middleware remained intact. No cookie, ticket,
password, or secret values were saved in evidence.

The final run passed **27 recorded browser assertions**, covering:

- All Trips star controls, the dedicated Starred Trips page, and Trip Detail
  saved state.
- Pointer starring, keyboard focus and Enter activation, and mobile touch
  starring/unstarring.
- Reload persistence on desktop and mobile.
- Controlled HTTP 500 responses for both PUT and DELETE: actionable failure
  feedback, unchanged visible state, and the failed DELETE preserving the
  actual database favorite. Retrying succeeded.
- A controlled failed Starred Trips request and successful visible retry.
- No horizontal overflow on All Trips, Trip Detail, or Starred Trips at the
  tested mobile width; the Detail star control met a visible 44-pixel target.
- A second genuinely Clerk-authenticated user seeing no owner favorites and
  receiving 404 for reading, starring, and unstarring the owner's known trip.
- Switching back to the owner without stale cross-account favorite state.
- Owner deletion of the synthetic trip.

Both final-run synthetic Clerk users were deleted, all sandbox-local database
fixtures were deleted, and the temporary browser profile was removed.
Earlier harness-only navigation/keyboard synchronization
issues were corrected in the external test harness, not in application code.
The final [browser log](../evidence/stars-parent/browser-run.log) and
[structured results](../evidence/stars-parent/browser-results.json) identify
the tested commit and cleanup counts.

Screenshots are from those genuine signed-in browser interactions, not the
signed-out screenshot service:

- [Desktop Starred Trips](../evidence/stars-parent/desktop-starred-trips.jpg)
- [Desktop failed star](../evidence/stars-parent/desktop-star-failure.jpg)
- [Desktop failed unstar](../evidence/stars-parent/desktop-unstar-failure.jpg)
- [Mobile All Trips](../evidence/stars-parent/mobile-all-trips.jpg)
- [Mobile Trip Detail](../evidence/stars-parent/mobile-trip-detail.jpg)
- [Mobile Starred Trips](../evidence/stars-parent/mobile-starred-trips.jpg)
- [Mobile failed-list retry](../evidence/stars-parent/mobile-status-failure.jpg)

These are browser results in addition to, not a replacement for, the API suite,
whose external Clerk boundary is mocked.

## Integration sequence

1. Keep the shared checkout and existing task work intact. Use this sandbox
   for any further parent verification; no more child Git-authentication retry
   is needed to obtain the baseline implementation.
2. Let the remaining failure-handling task return its own diff. Do not assume
   its local work is disposable. Compare against this exact tested baseline,
   retain genuinely new regression coverage, and avoid duplicating existing
   error behavior that passed the browser checks.
3. Stage this evidence independently and link it from PR #20 so it does not
   overwrite the child's documentation or implementation. Reconcile changes
   only after task review/approval, then rerun the checks affected by those
   changes before the final PR review.
4. Stop for the owner's PR review. Do not merge PR #20 or publish here.
5. After the owner-approved merge and publishing, perform the live checkpoint
   with the unchanged Autoscale resources. Feature 9 remains out of scope
   without approval.

There is no remaining external GitHub or Clerk authorization blocker for the
parent sandbox. The remaining gates are review/reconciliation and the later
owner-approved production checkpoint.
