#!/usr/bin/env bash
# Pull the freshly-built app image, apply migrations, restart the app container.
# This is the server-side step the CD pipeline runs over SSH — and the command
# to run by hand on the host for a manual deploy or rollback.
#
# Usage:
#   ./scripts/deploy.sh              # deploy APP_IMAGE from .env.docker (e.g. :latest)
#   ./scripts/deploy.sh sha-abc123   # deploy a specific GHCR tag (rollback)

# shellcheck source=_common.sh
source "$(dirname "$0")/_common.sh"

TAG="${1:-}"
if [[ -n "$TAG" ]]; then
  export APP_IMAGE="ghcr.io/wiibleyde/wildcard:${TAG}"
fi

# This script pulls from a registry — APP_IMAGE must point at GHCR, not the local
# build default. (Local dev uses `up --build`, not this script.)
if [[ -z "${APP_IMAGE:-}" || "$APP_IMAGE" == wildcard-app:* ]]; then
  die "APP_IMAGE must be a GHCR image (e.g. ghcr.io/wiibleyde/wildcard:latest). Set it in .env.docker or pass a tag: ./scripts/deploy.sh <tag>"
fi

info "Deploying image: $APP_IMAGE"

info "Pulling app image…"
$DC pull app

# db-migrate is a one-shot service that depends_on db (healthy) — Compose waits.
info "Applying migrations…"
$DC run --rm db-migrate

# --no-build: never rebuild on the server; we deploy the published image only.
info "Recreating app container…"
$DC up -d --no-build app

info "Pruning dangling images…"
docker image prune -f >/dev/null

success "Deploy complete"
