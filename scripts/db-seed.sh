#!/usr/bin/env bash
# Run seed.sql against the running DB.
# Usage: ./scripts/db-seed.sh

# shellcheck source=_common.sh
source "$(dirname "$0")/_common.sh"

SEED_FILE="supabase/seed.sql"
[[ -f "$SEED_FILE" ]] || die "$SEED_FILE not found"

wait_for_db

info "Running seed.sql…"
docker exec -i supabase-db \
  psql -U postgres -d "${POSTGRES_DB}" \
  < "$SEED_FILE"

success "Seed applied"
