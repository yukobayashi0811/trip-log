# Feature 2 — Relational Database

## Owner request (verbatim)

Feature 1 (Authentication) has been merged into `main`, and Trip Log has already been published on Replit.

The production deployment uses Autoscale with:
- 1 vCPU
- 1.0 GiB RAM
- Maximum 1 machine

Please verify the existing deployment and proceed with **Feature 2: Relational Database**, following the approved PLAN.md.

## 1. Verify the published application

- Retrieve and report the existing production URL.
- Confirm that the live application loads successfully.
- Verify that Clerk authentication and the PostgreSQL user synchronization work in production.
- Confirm that protected endpoints reject unauthenticated requests.
- Review the deployment logs for critical errors.
- If any verification requires my manual login, explain the steps and clearly distinguish verified results from untested behavior.

Do not create another deployment or change publishing settings during this verification.

If there is a critical production issue, report it before proceeding. Otherwise, continue to Feature 2.

## 2. Implement Feature 2: Relational Database

Read the approved PLAN.md from the latest `main` branch.

Implement the four remaining PostgreSQL tables using the existing Drizzle ORM architecture:

- `trips`
- `stops`
- `stays`
- `stars`

Preserve the existing `users` table and authentication functionality.

Follow the exact approved database design, including:

- Database-generated UUID primary keys.
- Required and optional fields with their specified types.
- Foreign keys and appropriate cascade deletion.
- One-to-many relationships between users, trips, and stops.
- One-to-zero-or-one relationship between stops and stays.
- Composite primary key `(user_id, trip_id)` for stars.
- Appropriate indexes, constraints, and referential integrity.
- Compatibility with the internal user IDs established in Feature 1.

Keep the implementation simple and limited to the database foundation.

Do not implement Trip CRUD, maps, route calculations, accommodation UI, stars UI, search, or dashboard features yet.

## 3. Testing

Run real database integration tests covering:

- Creation of valid relational records.
- Rejection of invalid foreign keys.
- Rejection of duplicate stars.
- Enforcement of the one-stay-per-stop relationship.
- Correct cascade deletion.
- Preservation of existing user accounts.
- Continued operation of the authentication functionality.
- Successful database schema application.
- Existing automated tests and TypeScript checks.

Use temporary test records and clean them up afterward.

Document genuine test results and limitations. Do not fabricate evidence or create artificial travel-history entries.

## 4. GitHub workflow

Follow the established workflow automatically:

1. Verify Feature 1 is merged into `main`.
2. Create a GitHub Issue for Feature 2.
3. Create `feature/database` from the latest `main`.
4. Implement and test Feature 2.
5. Update `schema.md` and relevant README sections.
6. Save actual development prompts and decisions in `prompts/database.md`.
7. Commit and push the branch.
8. Open a Pull Request linked to the Issue using `closes #N`.
9. Include implementation details, test results, and any limitations in the PR description.

Do not change the approved PLAN.md.

Do not commit directly to `main` or automatically merge the PR.

## 5. Deployment and cost control

The existing production deployment is already running.

- Keep the Autoscale settings unchanged.
- Apply schema changes only to the development database during this feature.
- Do not modify production database tables before the PR is reviewed and merged.
- Do not publish another deployment until I have personally merged Feature 2.
- Do not activate paid services, increase resource allocations, or incur additional charges without my approval.
- Prefer Free Mode for routine development.

After I merge Feature 2, we will update the production deployment and verify the production database schema.

## 6. Stop for review

When Feature 2 is complete, provide:

- Existing production URL and verification status.
- GitHub Issue URL.
- GitHub Pull Request URL.
- Summary of database changes.
- Actual test results.
- Any problems or deviations from PLAN.md.
- Any remaining manual steps.

**Stop for my review. Do not merge Feature 2 or begin Feature 3 until I explicitly authorize the next step.**

## Development decisions and actual results

- Verified authentication's PR is merged; fetched/read the approved plan from
  latest main and created `feature/database` from that main in an isolated clone.
- Confirmed the existing production URL, public page/API responses, Clerk
  environment availability, recent logs, and production users table using
  read-only queries. Signed-in production verification requires owner login;
  existing database rows were not treated as proof of fresh synchronization.
- Added only the four remaining tables and Drizzle relations/model types.
  No new dependencies, API endpoints, or UI.
- All UUID entity keys use PostgreSQL defaults; stars use the approved
  composite key. Users schema/authentication code are unchanged.
- All parent foreign keys cascade. Indexes cover owner/date, ordered stops,
  stay lookup, and both star directions.
- Stored category labels are Driving/Flying/Other and
  Hotel/Campground/Vacation Rental/Other, as text with SQL checks. Optional trip
  and stop types remain free text. Calendar dates remain date-only strings.
- Stop sort positions are nonnegative but not unique, allowing future atomic
  reordering without an unnecessary schema constraint.
- Expected invalid writes use PostgreSQL savepoints; every database fixture
  runs inside a rollback transaction. Existing non-test account identity is
  checked after the suite. No artificial travel history remains.
- Development schema push, full workspace TypeScript checks, and all 25 tests
  passed (16 database tests and nine existing authentication tests).
- No production schema mutation, deployment, resource change, or paid upgrade.
  No change to the approved PLAN.md and no implementation of Feature 3.
