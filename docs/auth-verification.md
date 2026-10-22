# Feature 1 verification

## Scope and automated results

Executed against the development PostgreSQL database on October 22, 2026 UTC.

- `pnpm --filter @workspace/api-server test`: **9 tests passed**.
- `pnpm --filter @workspace/api-server run typecheck`: **passed**.
- `pnpm run typecheck:libs`: **passed**.
- `pnpm run typecheck`: **passed across the workspace**.
- `pnpm --filter @workspace/trip-log run typecheck`: **passed after adding
  user-specific account query keys**.
- `pnpm install --frozen-lockfile --ignore-scripts` in the isolated feature
  branch checkout: **passed**.
- `pnpm --filter @workspace/db run push`: **applied users-only schema**.

The test suite uses the real Express router/guard, Drizzle upsert, and PostgreSQL.
Only Clerk's identity/profile boundary is mocked. It verifies:

1. Unauthenticated access returns JSON 401 and does not synchronize.
2. Forged identity headers/query parameters do not authenticate.
3. Correct internal UUID/email/creation date and persisted user.
4. Eight concurrent first requests produce exactly one internal record.
5. Verified email changes preserve internal UUID.
6. Distinct Clerk identities get distinct internal IDs, even with the same email.
7. Clerk failure produces generic 503 and creates no record.
8. Unverified primary email fails closed without provisioning.
9. Missing session after login returns 401.

These tests do not prove Clerk's actual password, email verification, or browser
logout behavior. Browser and real middleware checks are recorded below once run.
The assignment's comprehensive isolation red/green evidence begins with Trip
CRUD, not this authentication PR; no trip isolation or dashboard test is claimed.

## Browser / real middleware verification

One browser verification pass using the sanctioned Clerk programmatic sign-in:

- Signed-out `/account` redirected to the public landing page.
- Both `/sign-up` and `/sign-in` visibly rendered embedded forms. Neither form
  was submitted.
- A unique synthetic Clerk test identity signed in programmatically. The
  protected account page displayed its email and **Account synchronized**.
- Real same-origin authenticated `/api/auth/me` returned HTTP 200 with an
  internal UUID; reload preserved the same UUID and synchronized state.
- Clicking the actual **Log out** button returned to the public landing page;
  `/api/auth/me` then returned HTTP 401, and `/account` was again inaccessible.
- The mobile landing page had no horizontal overflow at the tested 390px
  viewport.
- An independent public landing screenshot confirmed desktop layout. Both
  managed application workflows were running successfully.

Real middleware HTTP checks through the development URL:

- No session: HTTP 401 JSON, `Cache-Control: no-store`.
- Fabricated session cookie: HTTP 401 JSON. This confirms rejection, not a
  comprehensive cryptographic validation test.

**Not verified:** new end-user password registration, receipt/completion of
email verification, and existing-user password login. Programmatic sign-in does
not prove these provider-hosted credential steps. No credentials were recorded.
Clerk's expected development-key warning and an input-autocomplete warning did
not block the tested flow. Production auth/proxy behavior has not been tested.

## Deployment

Not published. Production registration, separate production identity/database
configuration, and live verification remain unverified. The owner must review
and merge this PR first; then costs and Publish configuration must be checked
before the owner publishes. No paid service upgrade or paid fallback was enabled.
