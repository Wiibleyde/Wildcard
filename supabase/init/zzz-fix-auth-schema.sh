#!/bin/bash
# Fixes version mismatch between supabase/postgres:15.8.1.060 and supabase/gotrue:v2.x
#
# Problem: the postgres image ran GoTrue migrations but tracked them in
# public.schema_migrations (not auth.schema_migrations) and created GoTrue
# enum types in the public schema instead of auth.
#
# Fix:
#   1. Move GoTrue enum types from public → auth
#   2. Sync migration versions into auth.schema_migrations so GoTrue
#      doesn't try to re-run migrations already applied by the image.

psql -v ON_ERROR_STOP=1 -h "${PGHOST:-db}" -U postgres -d postgres <<'EOSQL'

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

-- 2. Sync: copy public.schema_migrations versions → auth.schema_migrations
INSERT INTO auth.schema_migrations (version)
SELECT version
FROM   public.schema_migrations
WHERE  version NOT IN (SELECT version FROM auth.schema_migrations);

-- 3. Create _realtime schema for supabase/realtime service
CREATE SCHEMA IF NOT EXISTS _realtime;
GRANT ALL ON SCHEMA _realtime TO postgres;

EOSQL

echo "Auth schema sync done."
