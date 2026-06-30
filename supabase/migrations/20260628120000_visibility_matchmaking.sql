-- ============================================================
-- Room visibility + matchmaking queue
-- ============================================================
-- Two features land together because they split the lobby in two:
--
--   * visibility — a room is now either 'private' (join by invite code only,
--     never surfaced anywhere) or 'public' (created by the matchmaker). Hand-
--     made rooms default to private, so we stop advertising a global lobby list.
--
--   * matchmaking_tickets — the quick-match queue. One row per waiting player.
--     A ticket with room_id IS NULL is still searching; once the matcher pairs
--     enough players it stamps them all with a freshly minted room id, which is
--     the signal (over Realtime) for every matched client to walk into the game.
--
-- Writes go through the service-role admin client (server-authoritative, like
-- rooms/games). The only client-facing grant is "read your own ticket", which
-- is what lets Realtime deliver the match notification to its owner and no one
-- else.
-- ============================================================

-- --- Room visibility -----------------------------------------------------
alter table public.rooms
  add column visibility text not null default 'private'
    check (visibility in ('public', 'private'));

-- --- Matchmaking queue ---------------------------------------------------
create table public.matchmaking_tickets (
  user_id     uuid primary key references public.profiles(id) on delete cascade,
  module_id   text not null,
  -- NULL while searching; set to the matched room's id when paired. The PK on
  -- user_id means a player can hold at most one ticket (queue for one game).
  --
  -- Deliberately a SOFT pointer (no FK to rooms): the matcher pre-allocates the
  -- room id and stamps every claimed ticket with it inside one atomic claim,
  -- BEFORE the application materialises the room row — an ordering a FK would
  -- reject. Dangling is handled in code (a failed formation nulls it again, and
  -- status reads tolerate a missing room) and tickets are transient anyway
  -- (overwritten on re-queue, dropped once the match is read).
  room_id     uuid,
  created_at  timestamptz not null default now()
);

-- The waiting pool the matcher scans: oldest-first within a game. Partial index
-- keeps it to just the still-searching rows.
create index matchmaking_waiting_idx
  on public.matchmaking_tickets (module_id, created_at)
  where room_id is null;

alter table public.matchmaking_tickets enable row level security;

-- A player may read only their own ticket — enough for Realtime to push the
-- "you've been matched" update to them, and nothing about anyone else's queue.
create policy "own ticket is viewable"
  on public.matchmaking_tickets for select
  using (auth.uid() = user_id);

-- All writes are server-only (matcher + enqueue/leave run as service_role).
create policy "only service role writes tickets"
  on public.matchmaking_tickets for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- --- Atomic matcher ------------------------------------------------------
-- Claim the oldest waiting tickets for one game and bind them to a new room id,
-- all in a single transaction. FOR UPDATE SKIP LOCKED is what makes concurrent
-- matchers safe: two callers firing at once each lock a *disjoint* set of rows,
-- so the same player is never handed to two rooms. Returns one (room_id,
-- user_id) row per claimed player (host first), or nothing when fewer than
-- p_min are ready — in which case no ticket is touched and everyone keeps
-- waiting.
create or replace function public.match_make(
  p_module_id text,
  p_min int,
  p_max int
)
returns table (room_id uuid, user_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room uuid := gen_random_uuid();
  v_ids uuid[];
begin
  select array_agg(t.user_id order by t.created_at)
    into v_ids
  from (
    select mt.user_id, mt.created_at
    from matchmaking_tickets mt
    where mt.module_id = p_module_id and mt.room_id is null
    order by mt.created_at
    limit p_max
    for update skip locked
  ) t;

  if v_ids is null or array_length(v_ids, 1) < p_min then
    return; -- not enough players; locks release at commit, tickets stay queued
  end if;

  update matchmaking_tickets
    set room_id = v_room
    where matchmaking_tickets.user_id = any(v_ids);

  return query select v_room, unnest(v_ids);
end;
$$;

revoke all on function public.match_make(text, int, int) from public;

-- --- Realtime publication ------------------------------------------------
-- Mirror the idempotent pattern from 20260618000000: full row image so UPDATE
-- payloads carry room_id, and add the table only if not already a member.
do $$
begin
  if not exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) then
    create publication supabase_realtime;
  end if;

  execute 'alter table public.matchmaking_tickets replica identity full';

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'matchmaking_tickets'
  ) then
    execute 'alter publication supabase_realtime add table public.matchmaking_tickets';
  end if;
end
$$;
