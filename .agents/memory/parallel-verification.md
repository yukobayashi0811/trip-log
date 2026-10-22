---
name: Parallel verification
description: Trip Log integration ownership, parallel-work protection, and temporary-server lifecycle constraints.
---

## Integration ownership

For Trip Log, Agent handles Git operations, branch setup, file integration,
and technical verification. Do not hand the user manual Git, checkout, or file
copying steps. Project changes go through branches and Pull Requests, never
direct commits to main.

**Why:** the user explicitly requested Agent-managed integration and a
branch-and-PR workflow.

**How to apply:** preserve the shared checkout, backup refs, setup changes,
and every other task's local work. Do not reset, clean, force-push, stop,
cancel, overwrite, or merge other task work without approval. Prefer a real
independent Git checkout and separate test runtime/database when another task
or Preview depends on the shared checkout.

## Temporary listener side effects

Starting a separate server can automatically add port mappings to `.replit`,
even when Agent never edits the shared workflow configuration.

**Why:** isolated frontend/API listeners triggered new mappings during
verification. Their original shared Preview mapping remained unchanged.

**How to apply:** compare configuration before and after temporary listeners.
If parking the sandbox, stop only its own processes and remove only its own
auto-added mappings through the supported configuration validation flow.
Preserve all pre-existing mappings and other tasks' services.

## Background process lifetime

Run long-lived temporary servers as foreground processes inside managed
background shell tasks, rather than detached daemons from short shell calls.

**Why:** a detached local PostgreSQL daemon reported successful startup but was
reaped after the launching tool call; a managed foreground background task
remained available.

**How to apply:** retain the temporary process handles for targeted cleanup;
never use broad process-kill commands that could affect shared services.
