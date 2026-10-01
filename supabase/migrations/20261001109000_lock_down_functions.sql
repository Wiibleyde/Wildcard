-- ============================================================
-- Functions are server-only unless explicitly allow-listed
-- ============================================================
-- 20260531000000_schema.sql copied the `public` schema contract, including
--   alter default privileges in schema wildcard grant all on functions to anon, authenticated
-- so every function created in the schema — the SECURITY DEFINER ones
-- included — was callable by any client through PostgREST (`/rpc/...`). A
-- signed-in user could call apply_elo_results / award_game_xp to mint rating
-- and XP, match_history to read anyone's games (it reads the secret state),
-- match_make to drain the queue, increment_xp / decrement_xp, or the prune job.
-- The `revoke ... from public` some of them carried did not help: the default
-- privileges had granted anon/authenticated explicitly.
--
-- From now on:
--   * the schema's default privileges no longer hand functions to the API
--     roles (PUBLIC's built-in EXECUTE cannot be removed per schema, so every
--     new function migration must still `revoke execute ... from public`);
--   * every existing function is revoked from PUBLIC, anon and authenticated,
--     and granted to service_role (the server);
--   * the allow-list below re-grants the few that clients legitimately call or
--     that RLS policies evaluate with the caller's privileges;
--   * every SECURITY DEFINER function gets a pinned search_path, pg_temp last,
--     so no caller-controlled object can shadow what it resolves.
-- This file sorts after the other migrations of this batch on purpose: the sweep
-- covers the functions they add.
-- ============================================================

alter default privileges in schema wildcard
  revoke all on functions from anon, authenticated;

-- Never called by anything (award_game_xp / settle_game replaced them).
drop function if exists wildcard.increment_xp(uuid, integer);
drop function if exists wildcard.decrement_xp(uuid, integer);

revoke execute on all functions in schema wildcard from public, anon, authenticated;
grant execute on all functions in schema wildcard to service_role;

-- ── Allow-list ──────────────────────────────────────────────
-- Leaderboard: rendered for guests and players (exposes only pseudo/avatar).
grant execute on function wildcard.leaderboard(integer) to anon, authenticated;
-- Pseudo/avatar lookup for the lobby, chat and roster (signed-in only).
grant execute on function wildcard.player_identities(uuid[]) to authenticated;
-- Evaluated inside RLS policies with the caller's privileges.
grant execute on function wildcard.can_equip_deck_style(text) to authenticated;
grant execute on function wildcard.can_equip_board_style(text) to authenticated;
grant execute on function wildcard.can_read_room(uuid) to anon, authenticated;
-- The shared auth.users trigger runs as the auth server's role.
grant execute on function wildcard.handle_new_user() to supabase_auth_admin;

-- ── Pin search_path on every SECURITY DEFINER function ──────
-- Functions already pinned to '' (fully qualified bodies) are left alone; the
-- others get the schema explicitly, with pg_temp last so a temporary table can
-- never shadow a table the function resolves unqualified.
do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'wildcard'
      and p.prosecdef
      and not coalesce(p.proconfig, '{}') @> array['search_path=""']
  loop
    execute format(
      'alter function %s set search_path = pg_catalog, wildcard, pg_temp',
      fn.signature
    );
  end loop;
end
$$;
