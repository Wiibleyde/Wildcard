#!/usr/bin/env bash
# Start Supabase services.
# Usage:
#   ./scripts/db-up.sh          # minimal stack (DB, auth, API, realtime)
#   ./scripts/db-up.sh studio   # + Studio UI, Storage, Meta

# shellcheck source=_common.sh
source "$(dirname "$0")/_common.sh"

PROFILE="${1:-}"

if [[ "$PROFILE" == "studio" ]]; then
  info "Starting full stack (with Studio)…"
  $DC --profile studio up -d --remove-orphans
else
  info "Starting minimal stack…"
  $DC up -d --remove-orphans --scale app=0
fi

success "Stack is up"
info "API:    http://localhost:${KONG_HTTP_PORT:-54321}"
[[ "$PROFILE" == "studio" ]] && info "Studio: http://localhost:${STUDIO_PORT:-54323}"
info "Inbucket: http://localhost:${INBUCKET_PORT:-54324}"
