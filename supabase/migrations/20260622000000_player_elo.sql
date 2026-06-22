-- ============================================================
-- Player ELO — independent rating per game module
-- ============================================================
-- One row per (player, game). A player's Belote rating is distinct from their
-- Président rating, so the table is keyed by the pair. Rows are created lazily
-- on the first rated game for that module (no per-profile seed trigger).
create table public.player_elo (
  user_id       uuid not null references public.profiles(id) on delete cascade,
  module_id     text not null,
  rating        integer not null default 1000 check (rating >= 0),
  games_played  integer not null default 0 check (games_played >= 0),
  wins          integer not null default 0 check (wins >= 0),
  updated_at    timestamptz not null default now(),
  primary key (user_id, module_id)
);

create index player_elo_module_rating_idx
  on public.player_elo (module_id, rating desc);

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.player_elo enable row level security;

-- Anyone can read ratings (leaderboards, profiles)
create policy "player_elo are viewable by everyone"
  on public.player_elo for select
  using (true);

-- Only the service role mutates ratings — never a direct client write. The ELO
-- is derived server-side from the engine's outcome(); the browser cannot forge it.
create policy "only service role can insert player_elo"
  on public.player_elo for insert
  with check (auth.role() = 'service_role');

create policy "only service role can update player_elo"
  on public.player_elo for update
  using (auth.role() = 'service_role');

-- ============================================================
-- Realtime
-- ============================================================
alter table public.player_elo replica identity full;

alter publication supabase_realtime add table public.player_elo;

-- ============================================================
-- Atomic post-game application (security definer — bypasses RLS)
-- ============================================================
-- Applies every participant's rating delta for one finished game in a single
-- transaction. `p_results` is a JSON array of {user_id, delta, won}; the delta
-- is computed server-side (src/lib/elo) from the game outcome and added to the
-- *current* stored rating so concurrent games for the same player compose
-- correctly. A missing row is created at the default 1000 base before the delta
-- applies (1000 + delta), matching the base the caller assumed.
create or replace function public.apply_elo_results(p_module_id text, p_results jsonb)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  r jsonb;
begin
  for r in select value from jsonb_array_elements(p_results)
  loop
    insert into public.player_elo (user_id, module_id, rating, games_played, wins)
    values (
      (r->>'user_id')::uuid,
      p_module_id,
      greatest(0, 1000 + (r->>'delta')::int),
      1,
      case when (r->>'won')::boolean then 1 else 0 end
    )
    on conflict (user_id, module_id) do update
    set rating       = greatest(0, public.player_elo.rating + (r->>'delta')::int),
        games_played = public.player_elo.games_played + 1,
        wins         = public.player_elo.wins
                       + (case when (r->>'won')::boolean then 1 else 0 end),
        updated_at   = now();
  end loop;
end;
$$;
