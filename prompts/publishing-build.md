# Publishing-build hotfix — actual user request

Confirmed: PR #16 has already been merged. Please proceed with a separate, minimal publishing-build hotfix.

1. Create a GitHub Issue describing build failure `9e45d4d4`, where the API artifact failed to execute `pnpm` with `ENOENT`.
2. Create `fix/publishing-build` from the latest merged `main`.
3. Safely transfer only the prepared, uncommitted build-command fixes onto that branch. Do not lose or accidentally commit unrelated changes.
4. Inspect the relevant Replit artifact manifests and failure logs to confirm the root cause. Use a solution compatible with the actual publishing environment, without assuming that pnpm or Corepack is installed there.
5. Keep the fix narrowly limited to the build configuration. Do not modify Feature 7 application behavior, the database, `PLAN.md`, authentication, or Autoscale resources.
6. Run TypeScript checks, the complete regression test suite, and frontend/API production builds. Document what was verified locally versus what still requires an actual Replit Publish.
7. Open a separate PR linked to the new Issue with `Closes #N`. Include the root cause, exact configuration changes, and test results.

Do not commit to `main`, merge, publish, or begin Feature 8.

Stop when the hotfix PR is ready for my review.

## Execution record

Created Issue #17 and prepared fix/publishing-build from merged main in an isolated checkout. Only build metadata/manifests and this hotfix documentation/prompt log are included. TypeScript checks, all 240 API regression tests, and both production builds passed locally, including a fresh-cache restricted-PATH bootstrap test. No cloud publishing, merge, application-code, database, authentication, PLAN.md, or Autoscale resource changes were performed.
