# Implemented schema — Authentication

Only `users` is implemented. The full approved five-table design remains in
PLAN.md; subsequent tables belong to later feature PRs.

| Column | PostgreSQL definition |
|---|---|
| `id` | `uuid PRIMARY KEY DEFAULT gen_random_uuid()` |
| `clerk_user_id` | `text NOT NULL UNIQUE` |
| `email` | `text NOT NULL` |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` |

Passwords, password hashes, session tokens, and verification codes are never
stored in this database.

Email is not the identity key and is intentionally not unique. Accounts are
resolved by verified Clerk user ID. An atomic `ON CONFLICT (clerk_user_id)
DO UPDATE` refreshes the verified primary email without changing the internal
UUID or creation timestamp, including during concurrent first requests.

The server calls Clerk to obtain the verified primary email; the browser cannot
supply either the identity or email for provisioning. A provider/database error
fails closed with a generic retryable error. Future trip ownership uses this
internal UUID, not email.

Development schema application: `pnpm --filter @workspace/db run push`.
Managed production schema application belongs to the owner-controlled Publish
flow. No startup migrations and no production DDL script.
