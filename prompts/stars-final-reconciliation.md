# Actual user prompt — final Feature 8 reconciliation

Feature 8's isolated verification is complete and the results are accepted.

Please coordinate the final reconciliation of Task #6 and prepare PR #20 for my final merge approval.

1. Check whether Task #6 ("Catch failed star requests before they mislead users") has completed. Preserve its work and inspect its actual diff before making any integration decision.

2. Compare Task #6's changes against PR #20's verified baseline commit `dff12a83086f02a0f9982d1b1988f68960a7655e`.

3. The independent browser verification already passed 27 assertions, including failed PUT/DELETE requests, retry, keyboard interactions, mobile layout, persistence, and account isolation. Do not duplicate working error-handling code or tests unnecessarily.

4. Integrate only justified improvements and missing regression coverage. Do not overwrite unrelated local commits or change the shared workspace.

5. Incorporate the relevant documentation, real browser screenshots, logs, and verification results from `verification/stars-parent-evidence-20261022` into PR #20. Avoid accidentally merging the evidence branch's duplicate Feature 8 source commits or opening a competing feature PR.

6. Rerun the full API regression suite, TypeScript checks, and both builds against the final PR head. If application behavior changes, rerun affected authenticated browser checks in the isolated environment.

7. Update PR #20's description so that it accurately records the authenticated browser verification, remaining limitations, and final test results.

Do not merge PR #20, publish, modify PLAN.md or Autoscale settings, or start Feature 9.

Stop once PR #20 is clean and ready for my final approval. Report its final commit SHA and the changes made during reconciliation.
