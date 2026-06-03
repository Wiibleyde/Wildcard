#!/usr/bin/env bash
# Create a new blank migration file with a UTC timestamp prefix.
# Usage: ./scripts/db-new-migration.sh <name>
# Example: ./scripts/db-new-migration.sh add_game_rooms

# shellcheck source=_common.sh
source "$(dirname "$0")/_common.sh"

NAME="${1:-}"
[[ -n "$NAME" ]] || die "Usage: $0 <migration_name>"

# Sanitise: lowercase, replace spaces/hyphens with underscores
NAME="${NAME,,}"
NAME="${NAME//[ -]/_}"
NAME="${NAME//[^a-z0-9_]/}"

TIMESTAMP="$(date -u +%Y%m%d%H%M%S)"
FILE="supabase/migrations/${TIMESTAMP}_${NAME}.sql"

cat > "$FILE" <<SQL
-- Migration: ${NAME}
-- Created:   $(date -u +"%Y-%m-%d %H:%M:%S UTC")

SQL

success "Created $FILE"
