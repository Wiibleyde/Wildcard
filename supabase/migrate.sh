#!/bin/sh
# ---------------------------------------------------------------------------
# Migration runner with version tracking.
#
# Every file in /migrations is applied AT MOST ONCE. Applied versions are
# recorded in public.schema_migrations, so re-running this container is a no-op
# instead of replaying the whole set — which spewed "already exists" errors and,
# worse, hid genuine failures behind `|| true`.
#
# Each migration runs in a SINGLE TRANSACTION with ON_ERROR_STOP: a real SQL
# error rolls that file back and aborts the whole run with a non-zero exit, so a
# broken migration fails the deploy loudly instead of printing "Migrations done".
# ---------------------------------------------------------------------------
set -eu

DB="${POSTGRES_DB}"
# Helper for status/bookkeeping queries: tuples-only, unaligned, stop on error.
q() { psql -h db -U postgres -d "$DB" -v ON_ERROR_STOP=1 -tAc "$1"; }

echo "Fixing auth schema (image/gotrue version mismatch)..."
sh /fix-auth-schema.sh

q "create table if not exists public.schema_migrations (
     version    text primary key,
     applied_at timestamptz not null default now()
   );" >/dev/null

# --- Baseline (one-time) ---------------------------------------------------
# An existing DB already at HEAD but with no history would otherwise have every
# migration replayed, and the first 'already exists' would abort the run. If the
# app schema is present (profiles table) but history is empty, mark every current
# file as applied WITHOUT running it — adopt the live schema as the baseline.
history=$(q "select count(*) from public.schema_migrations;")
has_schema=$(q "select (to_regclass('public.profiles') is not null);")
if [ "$history" = "0" ] && [ "$has_schema" = "t" ]; then
  echo "Existing schema, no migration history -> baselining current files as applied."
  for f in $(ls /migrations/*.sql 2>/dev/null | sort); do
    v=$(basename "$f")
    q "insert into public.schema_migrations(version) values ('$v') on conflict do nothing;" >/dev/null
    echo "  baselined $v"
  done
fi

# --- Apply pending ---------------------------------------------------------
applied=0
for f in $(ls /migrations/*.sql 2>/dev/null | sort); do
  v=$(basename "$f")
  if [ "$(q "select 1 from public.schema_migrations where version='$v';")" = "1" ]; then
    echo "skip   $v"
    continue
  fi
  echo "apply  $v"
  if psql -h db -U postgres -d "$DB" -v ON_ERROR_STOP=1 --single-transaction -f "$f"; then
    q "insert into public.schema_migrations(version) values ('$v');" >/dev/null
    applied=$((applied + 1))
  else
    echo "FAILED $v -- aborting (this file's changes were rolled back)" >&2
    exit 1
  fi
done

# --- Seed (dev only, idempotent) -------------------------------------------
if [ -s /seed.sql ]; then
  echo "Seeding..."
  psql -h db -U postgres -d "$DB" -f /seed.sql || echo "WARN  seed errors (continuing)"
fi

echo "Migrations done. ($applied applied this run)"
