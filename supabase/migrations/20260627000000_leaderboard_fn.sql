-- ============================================================
-- leaderboard(top_n) — per-game top-N ELO standings in one query
-- ============================================================
-- The page previously streamed the *entire* player_elo table to Node and sliced
-- the top N per module in JS. This ranks in the database with a window function
-- (row_number partitioned by module, rating desc) and returns only the rows the
-- page renders. The player_elo (module_id, rating desc) index serves the
-- partition + order directly, so the scan is bounded no matter how the table
-- grows.
--
-- Ratings are world-readable, but pseudos and avatars live in the portal's
-- `portal.profiles`, whose RLS only shows a user their own row (and friends').
-- Hence SECURITY DEFINER: it exposes exactly two public identity fields per
-- ranked player, nothing else of the portal. EXECUTE is granted to
-- anon/authenticated so guests see the board too. Deleted game profiles are
-- excluded *before* ranking (inner join inside the window subquery), so a
-- dangling row never consumes a top-N slot. The (rating desc, user_id) tie-break
-- makes the order deterministic instead of arbitrary on equal ratings.
-- ============================================================
create or replace function wildcard.leaderboard(p_top_n integer default 50)
returns table (
  module_id    text,
  user_id      uuid,
  username     text,
  avatar_url   text,
  rating       integer,
  games_played integer,
  wins         integer,
  rank         integer
)
language sql
stable
security definer
set search_path = wildcard
as $$
  select
    ranked.module_id,
    ranked.user_id,
    ranked.username,
    ranked.avatar_url,
    ranked.rating,
    ranked.games_played,
    ranked.wins,
    ranked.position::integer
  from (
    select
      e.module_id,
      e.user_id,
      pp.pseudo      as username,
      pp.avatar_path as avatar_url,
      e.rating,
      e.games_played,
      e.wins,
      row_number() over (
        partition by e.module_id
        order by e.rating desc, e.user_id
      ) as position
    from wildcard.player_elo e
    join wildcard.profiles p on p.id = e.user_id
    left join portal.profiles pp on pp.id = e.user_id
  ) ranked
  where ranked.position <= p_top_n
  order by ranked.module_id, ranked.position;
$$;

grant execute on function wildcard.leaderboard(integer) to anon, authenticated, service_role;
