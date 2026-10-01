-- ============================================================
-- Wildcard schema — dedicated schema on the shared Supabase
-- ============================================================
-- Wildcard lives in its own Postgres schema, next to the other apps of the
-- wiibleyde.dev infra (portal, kestion, …), instead of the shared `public`.
--
-- Written with the PRODUCTION name `wildcard` throughout, literally. The
-- migration runner (scripts/migrate.sh) rewrites every occurrence to the target
-- schema (e.g. `wildcard_dev`), so no migration may contain `wildcard_dev`.
-- Composed identifiers (trigger `on_auth_user_wildcard`, bucket
-- `wildcard-eca-images`) are renamed too: that is what keeps the prod and dev
-- schemas from fighting over a single name on the shared auth/storage tables.
--
-- Run as `supabase_admin` on the shared stack: the trigger on auth.users must be
-- owned by a role the plain `postgres` role is not on that instance.
-- ============================================================

create schema if not exists wildcard;

-- API roles: PostgREST switches to anon/authenticated/service_role per request.
-- supabase_auth_admin runs the auth.users trigger (else "Database error saving
-- new user" on every sign-up of every app).
grant usage on schema wildcard to anon, authenticated, service_role, supabase_auth_admin;

-- Same contract as the default `public` schema of a Supabase project: the API
-- roles get table privileges, and RLS (enabled on every table) decides rows.
alter default privileges in schema wildcard
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema wildcard
  grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema wildcard
  grant all on functions to anon, authenticated, service_role;
