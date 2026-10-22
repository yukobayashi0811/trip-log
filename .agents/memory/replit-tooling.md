---
name: Replit tooling precautions
description: Non-obvious behavior of local Git checkouts and the artifact launcher.
---

Verify the actual Git worktree root and remote branch before committing or pushing.

**Why:** An ignored directory that formerly held a checkout can remain without its own Git metadata; Git commands there then operate on the enclosing workspace. Replit checkpoint commits can also advance the local branch independently of GitHub.

**How to apply:** Check `git rev-parse --show-toplevel`, branch tracking, and the remote PR state. Never assume a named checkout directory is still an independent clone or push unrelated checkpoint commits.

Do not invoke `artifact-router --help` to inspect usage.

**Why:** In this environment it ignores the help flag and starts production artifact processes, which can conflict with running development ports.

**How to apply:** Treat it as a production launcher, not a read-only diagnostic command. Use documented configuration and build checks instead.
