#!/usr/bin/env bash
# Local Supabase (CLI) for development — mirrors the shared stack: Postgres 17,
# `wildcard` schema exposed, portal stub, seeded accounts.
#
#   bun run dev:up            # start + apply pending migrations
#   bun run dev:up --fresh    # start + wipe and rebuild (migrations + seed)
set -euo pipefail
cd "$(dirname "$0")/.."

supabase start

if [[ "${1:-}" == "--fresh" ]]; then
	supabase db reset
else
	supabase migration up --local
fi

echo
echo "Keys for .env.local (cp .env.local.example .env.local):"
supabase status -o env | grep -E '^(API_URL|PUBLISHABLE_KEY|SECRET_KEY)='
echo
echo "Then: bun run dev → http://localhost:3000/fr/dev-login"
