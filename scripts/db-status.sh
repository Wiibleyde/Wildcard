#!/usr/bin/env bash
# Show health and port status of all Supabase containers.
# Usage: ./scripts/db-status.sh

# shellcheck source=_common.sh
source "$(dirname "$0")/_common.sh"

info "Container status:"
$DC --profile studio ps --format "table {{.Service}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null \
  || $DC --profile studio ps

echo ""
info "Endpoints:"
printf "  %-18s %s\n" "API / Kong:"    "http://localhost:${KONG_HTTP_PORT:-54321}"
printf "  %-18s %s\n" "Studio:"        "http://localhost:${STUDIO_PORT:-54323}"
printf "  %-18s %s\n" "Inbucket mail:" "http://localhost:${INBUCKET_PORT:-54324}"
printf "  %-18s %s\n" "PostgreSQL:"    "localhost:${POSTGRES_PORT:-5432}"
