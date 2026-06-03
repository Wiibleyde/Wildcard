#!/usr/bin/env bash
# Tail logs for one service or all services.
# Usage:
#   ./scripts/db-logs.sh           # all services
#   ./scripts/db-logs.sh db        # just the DB
#   ./scripts/db-logs.sh auth      # just auth

# shellcheck source=_common.sh
source "$(dirname "$0")/_common.sh"

SERVICE="${1:-}"

if [[ -n "$SERVICE" ]]; then
  $DC --profile studio logs -f "$SERVICE"
else
  $DC --profile studio logs -f
fi
