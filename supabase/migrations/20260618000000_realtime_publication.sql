-- ============================================================
-- Realtime publication — make membership idempotent & self-healing
-- ============================================================
--
-- The game tables were first added to `supabase_realtime` in
-- 20260606120000_games.sql with bare `alter publication ... add table`. On the
-- self-hosted docker-compose stack that has two failure modes, both of which
-- show up as "multiplayer doesn't update in real time" (the app limps along on
-- its polling fallback instead):
--
--   1. db-migrate replays EVERY migration on each `up`, piping each through
--      `|| true`. A re-run of a bare `add table` errors with "relation is
--      already member of publication" — swallowed, but it also means any *real*
--      failure in the same step is invisible.
--   2. If `supabase_realtime` does not exist yet when migrations run (init
--      ordering against the realtime container), all four `add table`
--      statements fail and are swallowed. Realtime then carries no
--      postgres_changes for the game tables and clients never get the doorbell.
--
-- This migration makes the setup idempotent and self-healing: create the
-- publication if missing, force replica identity, and add each table only when
-- it is not already a member. Safe to run any number of times — which is
-- exactly what the dev (`bun run up`) and prod boot paths both do.
-- ============================================================

-- Ensure the publication exists before anything tries to alter it.
do $$
begin
  if not exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) then
    create publication supabase_realtime;
  end if;
end
$$;

-- Force a full row image (so UPDATE payloads carry the changed columns) and add
-- each game table to the publication only if it is not already a member.
do $$
declare
  tbl text;
begin
  foreach tbl in array array['rooms', 'room_players', 'games', 'game_actions']
  loop
    execute format('alter table public.%I replica identity full', tbl);

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = tbl
    ) then
      execute format(
        'alter publication supabase_realtime add table public.%I', tbl
      );
    end if;
  end loop;
end
$$;
