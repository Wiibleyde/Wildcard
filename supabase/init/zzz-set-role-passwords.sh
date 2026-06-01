#!/bin/bash
# Sets passwords on Supabase internal roles so that other services
# can authenticate via scram-sha-256 (required by pg_hba.conf).
# Runs last (zzz prefix) after the Supabase base init scripts.
set -e

psql -v ON_ERROR_STOP=1 -U postgres -c "ALTER ROLE supabase_auth_admin    WITH LOGIN PASSWORD '$POSTGRES_PASSWORD';"
psql -v ON_ERROR_STOP=1 -U postgres -c "ALTER ROLE authenticator           WITH LOGIN PASSWORD '$POSTGRES_PASSWORD';"
psql -v ON_ERROR_STOP=1 -U postgres -c "ALTER ROLE supabase_storage_admin  WITH LOGIN PASSWORD '$POSTGRES_PASSWORD';"
psql -v ON_ERROR_STOP=1 -U postgres -c "ALTER ROLE supabase_admin          WITH LOGIN PASSWORD '$POSTGRES_PASSWORD';"

echo "Role passwords set."
