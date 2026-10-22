# Feature 1 — Authentication prompts

## Owner's development request (verbatim)

The initial PLAN.md pull request has been merged.

Please verify the merge on GitHub, read the approved PLAN.md from the latest `main` branch, and proceed with **Feature 1: Authentication**.

Follow the approved plan and automate the GitHub workflow as much as possible.

### 1. GitHub Workflow

1. Create a GitHub Issue for Feature 1, using its user story from PLAN.md.
2. Create a dedicated `feature/auth` branch from the latest `main`.
3. Implement and test the authentication feature on that branch.
4. Save the key development prompts in `prompts/auth.md`.
5. Commit and push the changes.
6. Open a Pull Request into `main`, linking the Issue with `closes #N`.
7. Include implementation details, test results, and any problems or design decisions in the PR description.

### 2. Authentication Requirements

Implement the authentication functionality specified in PLAN.md:

- Allow new users to sign up directly within Trip Log.
- Support login and logout.
- Use Replit-managed Clerk Auth, as planned.
- Create or synchronize a corresponding record in the application's `users` table.
- Use Clerk's unique user ID to prevent duplicate user records.
- Protect authenticated pages and backend endpoints.
- Establish server-side authentication and authorization foundations for future user-specific trip data.
- Never store passwords in our database.
- Handle authentication errors gracefully.

Follow the approved React, Express, PostgreSQL, and Drizzle architecture.

You may implement the minimum database infrastructure necessary for authentication, including the `users` table. Leave the remaining relational tables and application features for subsequent PRs.

### 3. Testing

Verify as much of the following as the current development environment supports:

- A new user can register.
- An existing user can log in.
- A logged-in user can log out.
- An unauthenticated user cannot access protected endpoints.
- A user record is created correctly without duplicates.
- Authenticated backend requests resolve to the correct internal user.

Document actual test results. Clearly identify anything that cannot yet be tested.

The assignment's comprehensive cross-user data-isolation test will begin with Trip CRUD and be expanded as subsequent features are implemented.

### 4. Scope and Cost Control

- Implement only Feature 1.
- Do not begin Feature 2 or unrelated application functionality.
- Reuse existing project structure.
- Prefer Free Mode and avoid unnecessary Agent credit consumption.
- Do not activate paid services or incur additional charges without my approval.
- Follow the merged PLAN.md if any implementation details are ambiguous.
- Explain any necessary deviations before implementing them.

### 5. Stop for Review

When Feature 1 is complete:

- Provide the GitHub Issue URL.
- Provide the Pull Request URL.
- Summarize the implementation.
- Report the tests performed and their results.
- Identify any blockers or manual setup required.
- Explain any differences from PLAN.md.

**Do not merge the PR yourself. I will review and personally merge it.**

Do not begin the next feature until I confirm the merge.

If the application is not yet deployable, document that limitation rather than claiming a successful deployment.

## Agent decisions

- Verified the planning PR was merged and read PLAN.md from latest GitHub main.
- Reused existing pnpm/Express/Drizzle scaffolding and added the requested web
  artifact at the root. No separate design-system artifact or prerequisite PR.
- Provisioned Replit-managed Clerk using the platform integration, with no
  manually copied credentials or provider substitution.
- Added only users; unique Clerk ID is the synchronization key. Verified primary
  email is read server-side, with atomic upsert for concurrent first requests.
- Browser uses Clerk session cookies; server routes resolve the internal UUID.
- Account query cache keys also include the loaded Clerk user ID, in addition
  to clearing the query cache on identity changes, to avoid stale-account flashes.
- Matched React/React DOM's 19.1 patch to Clerk's supported peer range.
- Integration tests mock only Clerk, exercise the real PostgreSQL database,
  and clean up only their synthetic test records.
- No features beyond authentication and no publication before owner review.

## Frontend implementation prompt (verbatim)

Build ONLY Feature 1 authentication frontend in artifacts/trip-log. Trip Log — Your journeys, mapped. Personal private travel journal, warm off-white with muted teal/forest per approved PLAN.md. Inviting and intentional personal space, responsive accessible UI and restrained micro-interactions. Scope: public landing /, embedded Clerk signup /sign-up/*? and login /sign-in/*?, protected /account showing internal account email and confirmation synchronization succeeded, logout to landing. No trip/map/dashboard functionality, fake data or extra navigation. No separate design system. Use canonical Clerk wiring verbatim from setup reference (read full web sections), logo.svg and matching Clerk appearance. Auth server GET /api/auth/me syncs internal users and returns {id,email,createdAt}; 401 or 503 graceful errors with retry. Cookies only. Query data must clear on account change; gate internal user request on loaded signed-in state; key/remount by Clerk user ID to prevent stale identity display. Hooks: useGetCurrentUser/getGetCurrentUserQueryKey and useHealthCheck/getHealthCheckQueryKey from @workspace/api-client-react. Use current user hook; health hook optional because only account surface in scope. Use queryKey explicitly in options. Set unique page titles and metadata. Do not screenshot/test/start workflows. Do not use generated media or paid services. Only modify frontend artifact; packages already @clerk/react, themes installed. Handle signing-out errors and loading too. See PLAN.md for scope; backend main agent handles. Follow exact /sign-in/*? routes and full Clerk path props. No UserButton.

## Browser verification prompt (verbatim)

Verify the Feature 1 authentication journey for Trip Log at /. This is Replit-managed Clerk Auth; login claims MUST be overridden using the Clerk Auth programmatic sign-in capability (not hand-entering passwords in Clerk components). Start signed out: protected /account should return landing; GET /api/auth/me must be 401 JSON. Visit /sign-up and /sign-in to verify embedded forms visually load, but do not interact with Clerk signup/login forms. Then programmatically sign in as a unique synthetic user {firstName: Trip, lastName: Tester, email: auth<nanoid(6)>@example.com} and override claims as required. Navigate /account: show matching email and Account synchronized; same-origin GET /api/auth/me returns internal UUID. Reload: same UUID; optionally database count for this exact clerk_user_id equals one. Use actual UI Log out: lands /, then API 401 and /account inaccessible. Mobile 390px signed-out landing should fit without overflow. Do not implement features or modify code. Report clearly that programmatic sign-in is NOT proof of real end-user password registration/email verification or password login. Save screenshots of verification if supported. Relevant code artifacts/trip-log/src/App.tsx, artifacts/api-server/src/middlewares/require-user.ts, lib/db/src/schema/users.ts. DB users {id uuid, clerk_user_id unique text, email text, created_at}; backend sync reads real Clerk user profile verified primary email. If tester-provided identity is not a real Clerk user or fails profile lookup, report blocker, do not bypass production guard or seed fake accounts to pass. Avoid outputting credentials or session tokens.

## Verification outcome

Nine backend integration tests passed; full workspace typecheck passed. The
browser pass confirmed signed-out protection, visibly embedded forms, real
authenticated account synchronization, stable internal UUID after reload,
logout via the UI, and mobile fit. Actual password registration/email
verification/password login were not exercised. No production deployment.
See docs/auth-verification.md for the explicit test boundary.
