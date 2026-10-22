# Publishing build hotfix

## Root cause and scope

Issue: https://github.com/yukobayashi0811/trip-log/issues/17

Publishing build 9e45d4d4-94ea-4db5-b2a0-6b721986e17b failed before compilation on 2026-10-22. Its complete available log reports:

    Failed to start deployment command in artifact 3B4_FFSkEVBkAeYMFRJ2e: pnpm
    ENOENT: spawn pnpm ENOENT (ENOENT)

The security scan completed; it was not the reported cause. Both artifact manifests on merged main invoked pnpm directly. Development's global pnpm availability therefore did not establish that the publishing command could launch it. The API run command and startup-health path are not implicated by this build-stage failure.

## Exact configuration changes

- package.json declares packageManager pnpm@10.26.1, matching the existing lockfile/toolchain. No dependency or lockfile changes.
- Both production build commands use the Node/npm bootstrap below, replacing direct invocation of a global pnpm binary. It does not require globally installed pnpm or Corepack.

    npm exec --yes --package=pnpm@10.26.1 -- pnpm --filter @workspace/api-server run build
    npm exec --yes --package=pnpm@10.26.1 -- pnpm --filter @workspace/trip-log run build

- API build environment retains NODE_ENV=production.
- The web build explicitly receives PORT=21377 and BASE_PATH=/ through services.production.build.env. These are the existing service values, not resource changes. A plain local build without its artifact environment rejects missing PORT; this is defensive build-time configuration, not a second error observed in the failed cloud log.
- Artifact IDs, development commands, API production run command, health path, static output directory, rewrites, and runtime environment remain unchanged.

## Verification performed locally

Validation ran in a separate checkout of the latest merged GitHub main, on fix/publishing-build. Only the selected configuration files were transferred; no local checkpoint history or unrelated .replit changes were transferred.

- Frozen-lockfile dependency install passed with pnpm 10.26.1; lockfile unchanged.
- pnpm run typecheck passed for libraries, API, frontend, and scripts.
- LOG_LEVEL=error pnpm --filter @workspace/api-server test: 240 tests passed across 11 files. Existing regression tests used development fixtures; no production database operations were performed.
- Both exact production build arrays were read from the changed TOML and executed successfully with their declared build environments.
- Bootstrap verification used a restricted PATH with Node/npm and system utilities only. Assertions confirmed pnpm and Corepack were absent before invocation. A new empty npm cache forced the pinned manager to be obtained through npm exec rather than relying on a previously cached manager.
- Local toolchain: Node 24.13.0, npm 11.6.2, bootstrapped pnpm 10.26.1.
- Existing nonfatal warnings remain: Vite tooltip source-map location, frontend chunk-size advisory, and npm warnings about pnpm-specific .npmrc options.

## Still requires an actual Replit Publish

No Publish or deployment retry was performed. Local tests prove the bootstrap does not depend on global pnpm/Corepack; they cannot prove the current cloud runner's PATH, npm availability, registry connectivity, dependency-install stage, or promotion health checks. The command intentionally relies on the Node/npm toolchain and npm registry access. After review and merge, the owner must Publish and check the cloud build, promotion, API health, and signed-in application. If npm itself is unavailable, publishing toolchain provisioning still needs attention; no cloud success is claimed here.

No Feature 7 application behavior, authentication, schema/data, PLAN.md, Autoscale target/resources, or Feature 8 work is included. Unrelated workspace changes were left intact.
