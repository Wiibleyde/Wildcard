-- ============================================================
-- The move log is server-only
-- ============================================================
-- `game_actions` was readable by every authenticated user and streamed over the
-- `supabase_realtime` publication. The log is not public-safe: some actions
-- carry hidden information by nature (the Tarot taker's discard — the cards put
-- face down in the écart), and any signed-in user could read the full move log
-- of any game, private room or not.
--
-- Every legitimate reader already runs server-side on the service role (live
-- log feed in src/lib/models/game.ts, replay in src/lib/models/replay.ts, the
-- match_history function), and the service role bypasses RLS. So the client
-- SELECT policy goes and the table leaves the Realtime publication; clients see
-- the log only through `view()`-shaped API payloads.
-- ============================================================

drop policy if exists "game actions are viewable by authenticated users"
  on wildcard.game_actions;

do $$
begin
  if exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'wildcard'
      and tablename = 'game_actions'
  ) then
    execute 'alter publication supabase_realtime drop table wildcard.game_actions';
  end if;
end
$$;
