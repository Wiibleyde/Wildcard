#!/usr/bin/env bash
# Apply all migrations (in order) against the running DB.
# Usage: ./scripts/db-migrate.sh

# shellcheck source=_common.sh
source "$(dirname "$0")/_common.sh"

wait_for_db

info "Running migrations…"
$DC run --rm db-migrate

success "Migrations applied"
