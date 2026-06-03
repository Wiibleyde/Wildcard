#!/usr/bin/env bash
# Regenerate src/lib/supabase/types.ts from the live DB schema.
# Requires: supabase CLI  (npm i -g supabase  or  brew install supabase/tap/supabase)
# Usage: ./scripts/db-types.sh

# shellcheck source=_common.sh
source "$(dirname "$0")/_common.sh"

command -v supabase &>/dev/null || die "supabase CLI not found. Install: npm i -g supabase"

OUT="src/lib/supabase/types.ts"
DB_URL="postgresql://postgres:${POSTGRES_PASSWORD}@localhost:${POSTGRES_PORT:-5432}/${POSTGRES_DB}"

info "Generating TypeScript types from DB schema…"
supabase gen types typescript \
  --db-url "$DB_URL" \
  --schema public \
  > "$OUT"

success "Types written to $OUT"
