#!/usr/bin/env bash
# Apply the migrations to a schema of the SHARED Supabase (default: the
# `wildcard_dev` dev twin). Run on the infra host: Postgres is not published, so
# the runner joins the Supabase Docker network.
#
#   WILDCARD_DATABASE_URL=postgresql://supabase_admin:…@supabase-db:5432/postgres \
#     bun run db:apply:shared [wildcard_dev]
#
# Prod (`wildcard`) is migrated by the app container's entrypoint on deploy.
set -euo pipefail
cd "$(dirname "$0")/.."

TARGET="${1:-wildcard_dev}"
NETWORK="${SUPABASE_NETWORK:-supabase}"
: "${WILDCARD_DATABASE_URL:?set WILDCARD_DATABASE_URL (supabase_admin DSN)}"

docker run --rm --network "$NETWORK" \
	-v "$PWD/supabase/migrations:/migrations:ro" \
	-v "$PWD/scripts/migrate.sh:/migrate.sh:ro" \
	-e WILDCARD_DATABASE_URL -e WILDCARD_SCHEMA="$TARGET" \
	-e WILDCARD_MIGRATIONS_DIR=/migrations \
	postgres:17-alpine sh /migrate.sh
