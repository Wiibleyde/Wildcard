#!/usr/bin/env bash
# ⚠️  DESTRUCTIVE — wipe volumes, restart stack, re-run all migrations + seed.
# Usage: ./scripts/db-reset.sh [--yes]

# shellcheck source=_common.sh
source "$(dirname "$0")/_common.sh"

if [[ "${1:-}" != "--yes" ]]; then
  warn "This will DELETE all data (volumes: db-data, storage-data)."
  read -rp "Type 'yes' to confirm: " CONFIRM
  [[ "$CONFIRM" == "yes" ]] || die "Aborted"
fi

info "Tearing down stack and removing volumes…"
$DC --profile studio down --volumes --remove-orphans

info "Starting fresh stack…"
$DC up -d --remove-orphans --scale app=0

wait_for_db

info "Running migrations + seed…"
$DC run --rm db-migrate

success "Reset complete — clean database with all migrations applied"
