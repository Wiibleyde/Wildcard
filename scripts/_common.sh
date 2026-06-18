#!/usr/bin/env bash
# Sourced by every script — sets PROJECT_ROOT, loads .env.docker, exports helpers.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

ENV_FILE=".env.docker"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "❌  $ENV_FILE not found. Copy .env.docker.example and fill in values." >&2
  exit 1
fi

# Load env WITHOUT `source`: values may contain spaces (e.g.
# STUDIO_DEFAULT_PROJECT=Wildcard Dev), which `source` tries to execute as a
# command ("Dev: command not found"). Parse KEY=VALUE line by line instead —
# docker's own `--env-file` (used by $DC below) already handles spaces, this
# just exposes the vars the scripts echo.
while IFS= read -r line || [[ -n "$line" ]]; do
  [[ "$line" =~ ^[[:space:]]*# ]] && continue   # comment
  [[ "$line" == *=* ]] || continue              # skip blanks / non-assignments
  key="${line%%=*}"
  val="${line#*=}"
  val="${val%\"}"; val="${val#\"}"              # strip surrounding double quotes
  val="${val%\'}"; val="${val#\'}"              # …or single quotes
  export "$key=$val"
done < "$ENV_FILE"

DC="docker compose --env-file $ENV_FILE"

# Coloured helpers
info()    { printf '\033[34m▶ %s\033[0m\n' "$*"; }
success() { printf '\033[32m✔ %s\033[0m\n' "$*"; }
warn()    { printf '\033[33m⚠ %s\033[0m\n' "$*" >&2; }
die()     { printf '\033[31m✖ %s\033[0m\n' "$*" >&2; exit 1; }

wait_for_db() {
  info "Waiting for DB to be healthy…"
  local i=0
  until docker exec supabase-db pg_isready -U postgres -q 2>/dev/null; do
    ((i++)) && (( i > 30 )) && die "DB did not become healthy after 30s"
    sleep 1
  done
  success "DB ready"
}
