# Feature 4 — Consistent trip validation

## Production prerequisite

The owner personally merged Feature 3 and republished it. GitHub confirmed
PR #8 merged; all 162 repository files matched latest main. Production checks at
**https://trip-log.replit.app** found:

- Active public Autoscale deployment with successful build.
- `/`, `/sign-in`, `/trips`, health, and Clerk environment returned 200.
  The `/trips` response is the SPA shell, not proof of authenticated data.
- Unauthenticated trip list/create/update/delete returned 401.
- All five database tables exist; two users/two distinct Clerk IDs remain.
  Read-only aggregate evidence does not prove every historical field unchanged.
- Startup logs briefly showed pre-listener health-check 500s, followed by
  health/Clerk 200s; no ongoing application error in the reviewed logs.
- The owner explicitly answered **“All checks passed”** after checking
  production sign-in, trip creation/listing/reload, editing/clearing an optional
  field/reload, cancellation of deletion, and confirmed deletion.

That owner check completed the signed-in production checkpoint. The agent did
not borrow the owner's session, write production data, publish, or change the
existing 1 vCPU / 1.0 GiB / max 1 machine allocation.

## What this feature improves (not a repeat of Feature 3)

| Already present in Feature 3 | Improved in Feature 4 |
|---|---|
| Required title/dates, basic date validity/order and lengths | One shared schema/constants/messages/normalization for browser and API, rather than divergent hand-written client rules |
| Native browser required/date tooltips | Consistent inline errors on blur/submit, linked error summary, first-invalid focus, and accessible error/hint descriptions |
| API `fields` errors | Actionable labeled messages, safe `formErrors` for root/unknown-field errors, known-field-only client mapping, errors reset when corrected |
| Optional text clearing | Shared null normalization; preserve intentional indentation and outer line breaks of nonblank notes instead of silently trimming them |
| Malformed JSON 400 and oversized body 413 | Retained; add clear client recovery text and supported JSON-media/charset/encoding handling (415 instead of generic 500) |
| DB constraints and trip ownership checks | Unchanged; explicitly regression-tested alongside new validation boundaries |

No table/constraint changes or new third-party dependencies. The frontend links
the existing workspace `api-zod` package so the same validator actually runs in
both places; the lockfile only adds that workspace link.

## Rules and requests

- Title required, trimmed, nonblank, maximum **200** characters.
- Required date-only strings `YYYY-MM-DD`: real Gregorian calendar dates with
  years 0001–9999. Leap-year rules and one-day trips are supported.
- End date ≥ start date. No secondary ordering error if a date itself is invalid.
- Region ≤200, trip type ≤100; trim single-line fields.
- Notes ≤20,000, preserve nonblank whitespace/Unicode/line breaks. All-whitespace,
  absent, empty, or null optional fields clear to null, as in the existing PUT
  replacement contract.
- Limits use JavaScript UTF-16 code units, matching input `maxLength` on both
  sides; no artificial number-of-record limits.
- Reject embedded NUL before PostgreSQL, instead of returning a DB encoding 500.
- Strict field allowlist: ownership, UUIDs, timestamps and other unknown fields
  are not writable. No number/object/array/boolean-to-string coercion.
- POST/PUT require `application/json`; malformed/root-invalid bodies fail safely,
  payloads over the existing 100 KiB parser limit return 413, unsupported
  media/charset/content encoding return 415. Parser errors occur before the
  authenticated router; otherwise the existing guard and ownership remain intact.
- Field errors use `fields: { field: [messages] }`; safe root errors use
  `formErrors`. The OpenAPI error contract and generated types are updated.
  Messages do not echo untrusted field values or unknown-property names.

Forms retain all inputs after rejection; correction removes stale server errors.
Cancel cannot navigate away through its form link while a save is pending.
Successful CRUD navigation, list/detail cache behavior, authentication, ownership,
deletion confirmation, and schema are preserved.

## Actual automated verification

- **110 tests passed in 5 files**: the original 46 auth/schema/Trip CRUD
  regressions, 46 shared-validation boundary checks, and 18 new real-backend
  validation/preservation checks.
- [Actual full-suite output](../evidence/tests/validation-full-suite.txt).
- Shared checks: exact/over-limit values for every bounded field, required
  messages, invalid/ambiguous dates, leap centuries, lower/upper year boundaries,
  date ordering, optional null normalization, Unicode/notes whitespace, NUL,
  wrong types/root bodies, safe unknown-key errors, browser/server message parity.
- Integration checks use the real Express middleware, Drizzle, and development
  PostgreSQL, mocking only Clerk's external identity/profile boundary.
  Invalid POST/PUT attempts neither add a row nor alter the existing stored row;
  full rows are compared before/after. Valid exact-limit updates and date
  extremes round-trip without truncation; optional fields clear correctly.
  Malformed roots, unsupported media/charset/encoding and unknown metadata
  preserve the existing trip.
- Full workspace TypeScript checks passed; server typecheck also passed after
  the final encoding-error branch was added.
- Frontend production build passed. Existing nonblocking source-map warning and
  minified-chunk warning remain (about 169 kB gzip); no service/resource changes.

Feature 3's genuine ownership red/green evidence remains historical evidence in
`evidence/tests/`. Its test continues to pass; no new artificial red run was
needed for this validation PR.

### Focused development browser verification

One browser pass succeeded:

- Blank submission: three shared inline errors and linked summary; no POST;
  first-invalid Title focus; summary End date link correctly moves focus.
- Reversed dates: only the ordering error; no POST.
- Controlled transport injection changed only the outgoing title to whitespace,
  leaving original form values intact. The **real backend** returned 400; the
  UI focused Title, showed its field message and kept all typed values. Editing
  cleared the stale server error. This was intentional test input manipulation,
  not an application defect or a fabricated response.
- Corrected leap-day trip creation returned 201. Nonblank notes preserved exact
  outer/interior whitespace and newlines in the response and after reload.
- Invalid edit: no PUT, and a GET confirmed stored dates and notes unchanged.
  Correcting the date and clearing optional region/type saved with PUT 200.
- UI cleanup DELETE 204; subsequent trip GET 404. No unexpected app errors.
  Development Clerk/preload warnings were nonblocking.
- No optional mobile-width screenshot was taken in this focused run; the
  existing responsive layout was not redesigned.

The pre-login development user-ID baseline was compared with the real
authenticated account UUID rather than trusting the requested test claims.
The browser used a proven-new internal account. After its fixture trip was
deleted and absence of other trips/stars checked, exactly that internal account
was removed. Post-test queries confirmed **zero trips/stops/stays/stars and
zero reserved backend test users**. Existing accounts were not deleted.
The external test-helper identity was not removed through unsupported methods.
All browser checks were development-only, not production Feature 4 verification.

## Scope and review

Only existing trip forms/validation are changed. Future stop/stay validation
will arrive with those features. No maps, routing, accommodations, stars, search,
dashboard, or Feature 5. Approved PLAN.md, authentication configuration, database
schema and ownership predicates are unchanged.

Feature 4 is not published. Stop for the owner's PR review/personal merge, then
use the existing owner-controlled Publish flow and verify live validation.
