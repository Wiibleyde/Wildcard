#!/usr/bin/env bash
# Open an interactive psql shell, or run a one-liner.
# Usage:
#   ./scripts/db-psql.sh                          # interactive shell
#   ./scripts/db-psql.sh "SELECT * FROM profiles" # run query and exit
#   ./scripts/db-psql.sh < query.sql              # pipe a file

# shellcheck source=_common.sh
source "$(dirname "$0")/_common.sh"

QUERY="${1:-}"

if [[ -n "$QUERY" ]]; then
  docker exec supabase-db \
    psql -U postgres -d "${POSTGRES_DB}" -c "$QUERY"
elif [[ ! -t 0 ]]; then
  # stdin is a pipe/file
  docker exec -i supabase-db \
    psql -U postgres -d "${POSTGRES_DB}"
else
  docker exec -it supabase-db \
    psql -U postgres -d "${POSTGRES_DB}"
fi
