Implement one small usability improvement identified during my completed Stranger Test for Trip Log.

## Stranger Test findings

My wife, who is not taking this class, used the live application independently for approximately 10 minutes. She struggled with:

1. After creating a trip, not knowing how to add the first stop.
2. The Map appearing empty until a trip is selected.
3. Not understanding which transportation modes display route lines.

I have decided to fix **only issue #1**. Issues #2 and #3 should remain unchanged and be documented as intentional tradeoffs for my assignment reflection.

## Requested change: Add first stop

On the Trip Detail page, when the authenticated trip has **zero saved stops**, replace or enhance the existing empty itinerary message with a clear, prominent **"Add first stop"** button.

- The button should navigate to the existing map for that specific trip: `/trips/:id/map`.
- Reuse the existing stop-creation workflow.
- Show it only when the stops request succeeds and the stop count is zero.
- Do not show misleading empty states while loading or when the request fails.
- Once a stop exists, restore the normal itinerary display.
- Ensure the button is accessible and usable on desktop and mobile.

## Keep the implementation minimal

- No new APIs, database changes, packages, external services, or configuration.
- Do not redesign the application.
- Do not implement the other two Stranger Test suggestions.
- Do not modify the Dashboard, PLAN.md, or Plan vs. Reality documentation in this PR.
- Minimize Replit Agent usage and avoid unnecessary large-scale tests or repeated browser sessions.

## Development workflow

1. Start from the latest GitHub `main`.
2. Create a dedicated GitHub Issue documenting the Stranger Test findings, the selected fix, and the two deferred issues.
3. Create a small feature branch.
4. Implement the minimum frontend change.
5. Save the actual implementation prompt in `prompts/`.
6. Run focused verification, TypeScript checks, and the frontend build. Check that existing trip-detail functionality remains intact.
7. Open a PR referencing the Issue using `Closes #N`.

Preserve the actual Replit publishing workspace, local commits, backup refs, `.replit`, production data, and deployment settings.

Do not merge or Publish automatically. Stop with the PR ready for my review.

Report the changed files, test results, and PR URL.
