-- ============================================================
-- match_history: replay availability from the prune stamp
-- ============================================================
-- `has_moves` was "at least one game_actions row survives", and the history
-- page reads `version > 0 and not has_moves` as "replay expired". A game
-- force-ended at the deal (admin, forfeit, reaper) bumps its version without
-- ever logging a move, so it was wrongly labelled expired. The retention sweep
-- now stamps `games.actions_pruned_at` (20261001100200), which is the actual
-- answer: the replay is available unless the log was pruned. Same signature
-- and result shape, so src/lib/models/history.ts is unchanged.
-- ============================================================

create or replace function wildcard.match_history(
  p_user_id uuid,
  p_limit integer default 100
)
returns table (
  game_id    uuid,
  module_id  text,
  version    integer,
  created_at timestamptz,
  winner_ids uuid[],
  bot_ids    uuid[],
  players    jsonb,
  has_moves  boolean,
  pinned     boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    g.id,
    g.module_id,
    g.version,
    g.created_at,
    g.winner_ids,
    g.bot_ids,
    gs.state -> 'players' as players,
    g.actions_pruned_at is null as has_moves,
    exists (
      select 1 from wildcard.persistent_replays pr
      where pr.game_id = g.id and pr.user_id = p_user_id
    ) as pinned
  from wildcard.games g
  join wildcard.game_states gs on gs.game_id = g.id
  where g.is_over
    and gs.state @> jsonb_build_object(
      'players', jsonb_build_array(jsonb_build_object('id', p_user_id))
    )
  order by g.created_at desc
  limit p_limit;
$$;

revoke execute on function wildcard.match_history(uuid, integer) from public, anon, authenticated;
grant execute on function wildcard.match_history(uuid, integer) to service_role;
