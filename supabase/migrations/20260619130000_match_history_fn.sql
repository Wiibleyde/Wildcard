-- ============================================================
-- match_history(user, limit) — one indexed query for the history page
-- ============================================================
--
-- Replaces a three-roundtrip read (every game_states row the user ever sat in →
-- the matching games → every game_actions row of those games) that streamed
-- thousands of rows to Node and built an unbounded `IN (...)` list. This joins
-- games + game_states, filters to the viewer's *finished* games, orders by date
-- and caps with `p_limit` in the database, and folds replay-availability
-- (`has_moves`) and pin status (`pinned`) per row via cheap EXISTS lookups.
--
-- Participation lives in the secret engine state (`game_states.state.players`),
-- stamped at deal time and never mutated, so it survives a player leaving the
-- room. RLS denies that state to every client key, so the function is SECURITY
-- DEFINER — and its EXECUTE is revoked from all client roles below, so only the
-- service role (used by the server) can ask for a given user's history. A
-- client therefore can never request another account's matches.
-- ============================================================

-- Finished games, newest first — the function's driving scan. Partial index so
-- it only covers the rows the page ever reads.
create index if not exists games_over_created_at_idx
  on public.games (created_at desc)
  where is_over;

-- The participation match is a jsonb containment (`state @> {players:[{id}]}`).
-- jsonb_path_ops is the compact GIN opclass purpose-built for `@>`.
create index if not exists game_states_state_gin_idx
  on public.game_states using gin (state jsonb_path_ops);

-- has_moves EXISTS probes game_actions by game_id (PK is (game_id, seq), so the
-- column is already covered — kept explicit and idempotent for clarity).
create index if not exists game_actions_game_id_idx
  on public.game_actions (game_id);

create or replace function public.match_history(
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
set search_path = public
as $$
  select
    g.id,
    g.module_id,
    g.version,
    g.created_at,
    g.winner_ids,
    g.bot_ids,
    gs.state -> 'players' as players,
    exists (
      select 1 from public.game_actions a where a.game_id = g.id
    ) as has_moves,
    exists (
      select 1 from public.persistent_replays pr
      where pr.game_id = g.id and pr.user_id = p_user_id
    ) as pinned
  from public.games g
  join public.game_states gs on gs.game_id = g.id
  where g.is_over
    and gs.state @> jsonb_build_object(
      'players', jsonb_build_array(jsonb_build_object('id', p_user_id))
    )
  order by g.created_at desc
  limit p_limit;
$$;

-- Service-role only: a client must never be able to read another user's history
-- by calling this directly (SECURITY DEFINER would otherwise hand it the
-- RLS-denied secret state). Revoke the default PUBLIC execute, grant it back to
-- the service role the server uses.
revoke execute on function public.match_history(uuid, integer) from public;
grant execute on function public.match_history(uuid, integer) to service_role;
