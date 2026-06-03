#!/usr/bin/env bash
# Stop all Supabase services (keeps volumes).
# Usage: ./scripts/db-down.sh

# shellcheck source=_common.sh
source "$(dirname "$0")/_common.sh"

info "Stopping stack…"
$DC --profile studio down --remove-orphans
success "Stack stopped"
