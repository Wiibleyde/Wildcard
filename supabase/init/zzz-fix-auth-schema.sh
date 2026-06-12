#!/bin/bash
# Fixes version mismatch between supabase/postgres:15.8.1.060 and supabase/gotrue:v2.x
#
# Problem: the postgres image ran GoTrue migrations but tracked them in
# public.schema_migrations (not auth.schema_migrations) and created GoTrue
# enum types in the public schema instead of auth.
#
# Fix:
#   0. Create the `_realtime` schema the Realtime service migrates into
#   1. Move GoTrue enum types from public → auth
#   2. Sync migration versions into auth.schema_migrations so GoTrue
#      doesn't try to re-run migrations already applied by the image.
#
# Everything here is guarded so a missing object on a given image version can
# never abort the script (ON_ERROR_STOP) and skip a later step — in particular
# the `_realtime` schema, whose absence crash-loops the Realtime container with
# "no schema has been selected to create in".

psql -v ON_ERROR_STOP=1 -h "${PGHOST:-db}" -U postgres -d postgres <<'EOSQL'

-- 0. Realtime service schema. Created FIRST and unconditionally: the Realtime
--    container connects as supabase_admin, runs `SET search_path TO _realtime`,
--    then creates its Ecto migrations table there. If the schema is missing the
--    SET silently no-ops and every CREATE fails. This script runs as `postgres`
--    (NOT a superuser here), so it can't set `AUTHORIZATION supabase_admin` —
--    the schema is owned by postgres and supabase_admin gets CREATE via GRANT,
--    which is all the tenant migrations need.
CREATE SCHEMA IF NOT EXISTS _realtime;
GRANT ALL ON SCHEMA _realtime TO postgres, supabase_admin;

-- 1. Move GoTrue enum types from public to auth schema
DO $$ BEGIN
  ALTER TYPE public.factor_type   SET SCHEMA auth; EXCEPTION WHEN undefined_object OR wrong_object_type THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE public.factor_status SET SCHEMA auth; EXCEPTION WHEN undefined_object OR wrong_object_type THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE public.aal_level     SET SCHEMA auth; EXCEPTION WHEN undefined_object OR wrong_object_type THEN NULL;
END $$;

-- 2. Sync: copy public.schema_migrations versions → auth.schema_migrations.
--    Guarded — not every image tracks GoTrue migrations in public, and a
--    missing public.schema_migrations must not abort the script (step 0 above
--    would never run otherwise).
DO $$ BEGIN
  IF to_regclass('public.schema_migrations') IS NOT NULL THEN
    INSERT INTO auth.schema_migrations (version)
    SELECT version
    FROM   public.schema_migrations
    WHERE  version NOT IN (SELECT version FROM auth.schema_migrations);
  END IF;
END $$;

EOSQL

echo "Auth schema sync done."
