#!/usr/bin/env sh
# ---------------------------------------------------------------------------
# Migration runner for the shared Supabase (wiibleyde.dev infra).
#
# Applies supabase/migrations/*.sql to the target schema — `wildcard` in prod,
# `wildcard_dev` for development against the shared stack. Migrations are
# written with the production name; every occurrence is rewritten to the target
# (no word boundary on purpose: composed identifiers such as the
# `on_auth_user_wildcard` trigger or the `wildcard-eca-images` bucket must be
# renamed too, or both schemas fight over the same name on shared tables).
#
# Each file is applied AT MOST ONCE, recorded in <schema>.schema_migrations. A
# file runs in one transaction with its ledger row and an advisory lock: a
# migration is never recorded without having run, nor run twice by two
# containers booting together. A SQL error aborts with a non-zero exit.
#
# The connection needs a role that may create the schema and own the trigger on
# the shared auth.users — `supabase_admin` on the wiibleyde.dev stack. Inject
# WILDCARD_DATABASE_URL at runtime, never bake it into the image.
#
# Local development does NOT use this: the Supabase CLI applies the migrations
# untouched (`bun run dev:up`).
# ---------------------------------------------------------------------------
set -eu

MIGRATIONS_DIR="${WILDCARD_MIGRATIONS_DIR:-supabase/migrations}"
TARGET="${WILDCARD_SCHEMA:-wildcard}"

# Unset → no-op, so the image boots without a superuser DSN (e.g. a preview).
if [ -z "${WILDCARD_DATABASE_URL:-}" ]; then
	echo "migrate: WILDCARD_DATABASE_URL is not set — skipping migrations"
	exit 0
fi

if [ ! -d "$MIGRATIONS_DIR" ]; then
	echo "migrate: no migrations directory at $MIGRATIONS_DIR" >&2
	exit 1
fi

command -v psql >/dev/null 2>&1 || {
	echo "migrate: psql is not installed" >&2
	exit 1
}

case "$TARGET" in
wildcard | wildcard_*) ;;
*)
	echo "migrate: refusing target schema '$TARGET' (must be wildcard or wildcard_*)" >&2
	exit 1
	;;
esac

# The substitution is only reversible if the sources never mention a derived
# name. Comments are stripped first: they may legitimately document the rule.
if sed 's/--.*$//' "$MIGRATIONS_DIR"/*.sql | grep -q "wildcard_"; then
	echo "migrate: migrations mention 'wildcard_…' — write them with 'wildcard' alone" >&2
	exit 1
fi

LOCK_KEY="$(printf '%s' "wildcard-migrations-$TARGET" | cksum | cut -d' ' -f1)"

# Schema + ledger first: the ledger must exist before anything is recorded.
psql "$WILDCARD_DATABASE_URL" -v ON_ERROR_STOP=1 -q -v target="$TARGET" <<'SQL'
create schema if not exists :"target";
create table if not exists :"target".schema_migrations (
  version    text primary key,
  name       text not null,
  applied_at timestamptz not null default now()
);
SQL

WORK="$(mktemp -d)"
# shellcheck disable=SC2064
trap "rm -rf '$WORK'" EXIT

applied=0
skipped=0

for file in "$MIGRATIONS_DIR"/*.sql; do
	[ -e "$file" ] || continue
	base="$(basename "$file" .sql)"
	version="${base%%_*}"
	name="${base#*_}"

	sed "s/wildcard/$TARGET/g" "$file" >"$WORK/migration.sql"

	if ! output="$(
		psql "$WILDCARD_DATABASE_URL" -v ON_ERROR_STOP=1 -qtA \
			-v version="$version" -v name="$name" -v lock_key="$LOCK_KEY" \
			-v migration_path="$WORK/migration.sql" -v target="$TARGET" <<'SQL' 2>&1
begin;
select pg_advisory_xact_lock(:'lock_key'::bigint);
select case
         when exists (
           select 1 from :"target".schema_migrations where version = :'version'
         ) then 'false' else 'true'
       end as should_apply \gset
\if :should_apply
\i :migration_path
insert into :"target".schema_migrations (version, name) values (:'version', :'name');
\echo APPLIED
\else
\echo SKIPPED
\endif
commit;
SQL
	)"; then
		echo "migrate: FAILED on $base" >&2
		echo "$output" >&2
		exit 1
	fi

	case "$output" in
	*APPLIED*)
		applied=$((applied + 1))
		echo "migrate: applied $base"
		;;
	*) skipped=$((skipped + 1)) ;;
	esac
done

echo "migrate: $applied applied, $skipped already present (schema $TARGET)"
