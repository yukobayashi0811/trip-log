# Feature 3 — Actual instructions and decisions

## Owner request

> I've republished Trip Log after merging PR #6 (Feature 2: Relational Database).
>
> The Autoscale configuration remains unchanged: 1 vCPU, 1.0 GiB RAM, maximum 1 machine.
>
> I've also manually verified that I can sign in, see "Account synchronized," reload the page, and log out on the production site.
>
> Please verify that all five database tables exist in production, existing user records are preserved, and the live application is healthy.
>
> Once verification is successful, proceed with **Feature 3: Trip CRUD** according to the approved PLAN.md.
>
> Implement trip creation, listing, details, editing, and deletion with confirmation. Enforce server-side user ownership and include basic input validation.
>
> For the required data-isolation test, verify that User B cannot access or modify User A's trips. Capture genuine red and green test screenshots, explain what the test proves, and document what would break it.
>
> Follow the established GitHub workflow: create an Issue, feature branch, prompt log, tests, documentation, and Pull Request.
>
> Do not change the approved PLAN.md, commit directly to main, deploy unmerged changes, or activate additional paid services.
>
> **Do not merge the PR or begin Feature 4. Stop for my review.**
>
> Provide the Issue URL, PR URL, test results, and any outstanding problems.

The preceding detailed request is also preserved verbatim in
`attached_assets/Pasted-I-ve-personally-merged-PR-6-Feature-2-Relational-Databa_1792635474370.txt`
in the Replit workspace. Its relevant requirements are implemented here: use
the existing stack; owner-only list/create/detail/edit/delete; explicit deletion
confirmation; loading/error/empty states; genuine backend red/green evidence;
branch `feature/trip-crud`; stop at the PR.

## Agent decisions

- Verify production and the personal merge before creating the feature Issue
  and branch. Five tables and no schema difference confirmed; existing account
  aggregate matched. Manual production auth was owner-confirmed, not performed
  by the agent.
- Add GET/POST collection and GET/PUT/DELETE item endpoints. Use PUT full
  replacement to match the editor; optional omitted/blank fields clear.
- Keep date-only strings; validate actual calendar dates, required title,
  date ordering, field lengths, and strict writable fields.
- Use one shared ID+authenticated-owner predicate in each item SQL operation.
  Return the same 404 for absent and other-user records.
- Reject server-owned fields, including forged ownership, rather than silently
  assigning ownership from request metadata.
- Generate hooks/types from OpenAPI. Explicitly target React Query v5 and
  include DOM.Iterable in the client TS library after codegen exposed the need.
- Use actual real-DB test execution. Establish green, temporarily remove the
  owner predicate, capture the real failure, restore, capture passing results.
  Screenshots render the verbatim captured logs; this is disclosed rather than
  presenting them as native-terminal screenshots.
- A frontend design helper implements only the requested UI in the established
  visual style; it cannot change backend/schema/plan/GitHub/publishing scope.
- A browser testing helper verifies the changed signed-in CRUD/delete journey
  on development only, using programmatic Clerk test claims. No real passwords
  or session secrets are requested.
- No additional paid services, production mutations, resources, or deployments.

## Frontend helper instructions (scope summary)

The helper was instructed to build only `/trips`, `/trips/new`, `/trips/:id`,
and `/trips/:id/edit`, preserve auth/account screens, and follow the existing
warm paper/teal private-journal styling. It was given the generated five CRUD
hooks and exact Trip/TripInput contract, input limits, null-clearing semantics,
full-replacement PUT behavior, cache invalidation requirements, user-keyed
queries, date-only display rules, and accessible explicit deletion confirmation.
It was told to use real hooks/data, support loading/error/empty/not-found states,
create focused components, avoid fake history/emojis/new dependencies, and never
edit PLAN.md, backend/spec, Git, deployment, or future features.

This section is a labeled summary, not a fabricated verbatim transcript.

## Browser helper instructions and result (scope summary)

One development-only lifecycle with a programmatic Clerk testing identity:
required inputs block empty submission; create all fields; reload; edit title,
end date and multiline notes; clear region/type; reload; check list/mobile;
cancel delete without a request; confirm delete; check prior detail 404;
log out and verify private redirect/API 401. Use unique synthetic data only,
never modify genuine accounts, never print/persist credentials, and never
change code, publishing, or auth configuration.

The helper reported success. A cleanup-only follow-up asked whether the reported
claims mapped to a proven newly created backend account, because exact-email
development cleanup matched no row. It had not captured that mapping, so no
account deletion was attempted without proof. The trip itself was removed.
This is a scope summary; full actual results and limitations are in the
verification document.
