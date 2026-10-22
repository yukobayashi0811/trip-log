I want Replit Agent to manage the entire Feature 8 integration and verification workflow. I do not want to manually run Git commands, switch branches, or copy files.

Important: There are **two other active task trees in this same Replit project**, in addition to the blocked Feature 8 verification task.

Please act as the coordinating parent agent and resolve this safely.

## 1. Inspect all active work first

Determine:

- Which three task trees are currently active and what each is doing.
- Whether they share a working directory, Git state, development server, database, or Preview.
- Which tasks have uncommitted changes or important local commits.
- Whether either of the other two tasks could be disrupted by changing the active branch or application files.

Do not stop, cancel, merge, or overwrite the other tasks.

## 2. Preserve existing work

The previous inspection found:

- Active local branch: `feature/accommodations`
- Preserved backup: `backup/feature-accommodations-before-stars`
- Backup commit: `cf57b47774da426fbe8717399b6078d79bf6c4c0`
- Seven local commits that must not be lost
- Local changes to `.replit` and `scripts/post-merge.sh`
- Feature 8 PR #20 on GitHub: `feature/stars` at `dff12a83086f02a0f9982d1b1988f68960a7655e`

Reinspect the actual current state before taking action.

Never use destructive checkout, reset, clean, force-push, or operations that could overwrite work from another tree.

## 3. Resolve Feature 8 without disturbing parallel tasks

Prefer a properly isolated checkout or worktree containing the exact existing Feature 8 implementation from PR #20.

First check whether the required commit and Git objects are already available locally, including any verified isolated checkout.

If GitHub authentication is required, try only supported, authorized Replit integration mechanisms. Do not repeatedly retry the same failing authentication method or inspect, print, or embed credentials.

Do not recreate Feature 8 from scratch or copy ignored generated files into the main workspace as an untracked substitute.

If no safe way to obtain or activate the exact PR implementation exists, stop that operation and explain the specific remaining blocker.

## 4. Verify Feature 8

If an isolated development environment can be launched safely:

- Confirm the Starred Trips page, All Trips star controls, Trip Detail star controls, and authenticated API are present.
- Run the relevant automated tests and build checks.
- Verify starring, unstarring, persistence, failure/retry handling, keyboard accessibility, and mobile usability.
- Keep development servers, ports, and database operations isolated from the two other running tasks.
- Do not modify production data or bypass Clerk authentication.
- Clearly distinguish actual browser verification from automated API tests.

Do not replace the shared project Preview if doing so would interrupt another active task.

## 5. Coordinate instead of interfering

Allow the other two tasks to continue independently if they can do so safely.

Identify any dependencies or integration conflicts between the three tasks. Avoid duplicate implementations, concurrent branch switches in a shared checkout, or simultaneous changes to shared runtime configuration.

Prepare a single clear integration sequence that preserves every task's work.

## 6. Report back

Report:

1. All three active tasks and their working environments.
2. What has been safely preserved.
3. Whether Feature 8 is now available in an isolated development environment.
4. Actual test and browser verification results.
5. Any remaining blocker that genuinely requires an owner action.

Do not merge PR #20, publish, change PLAN.md or Autoscale settings, or begin Feature 9 without my approval.

Handle all technically possible coordination and setup yourself. Ask me to intervene only if a required external authorization cannot be completed by Agent.