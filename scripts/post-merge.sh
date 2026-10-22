#!/usr/bin/env bash
set -Eeuo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."
export CI=1
export PORT="${PORT:-21377}"
export BASE_PATH="${BASE_PATH:-/}"

echo "Installing workspace dependencies from the committed lockfile..."
pnpm install --frozen-lockfile --prefer-offline

echo "Applying non-forced Drizzle schema updates to the workspace database..."
pnpm --filter @workspace/db run push

echo "Regenerating API clients from the OpenAPI specification..."
pnpm --filter @workspace/api-spec run codegen

echo "Typechecking and rebuilding workspace packages..."
pnpm run build

echo "Post-merge setup completed."
