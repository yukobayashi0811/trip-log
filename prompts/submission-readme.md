# Submission README correction - actual task context

Date: November 3, 2026. Requested through Codex desktop.

## Owner request (relevant excerpt, verbatim)

> README、schema、9+ merged PRs、Test A/BのRed/Green証跡、GitHub教員・GSIのrepoアクセス、5分デモの必要性（グループの発表者かどうか）、bCourses提出物チェック、提出用パッケージ作成を実行し、指定Google Driveフォルダへ保存。

> 不要な新機能開発やReplit Agent usageは増やさない。

## Codex findings and chosen scope

README lacked the live URL, did not explicitly mention the PR #30 chart, and
retained the earlier 248-test count. The saved Feature 10 regression log records
255 passing tests in 13 files. Correct only these documentation statements and
label the test count as a recorded historical run. Do not imply a new regression
run or new production verification. Issue #31 tracks this correction.

The schema documentation was compared with the five Drizzle table definitions;
no schema correction was needed. Preserve PLAN.md, application source, deployment
configuration, and all private travel data. Use a branch and PR, not a direct
main commit. No Replit Agent invocation or new feature is required.

## Verification

- Checked the live URL against the owner's supplied URL and the live browser.
- Checked the test count against evidence/tests/dashboard/api-regression.log.
- Checked git diff --check and limited the diff to README plus this prompt log.
- Application tests/builds are not rerun for documentation-only changes.
