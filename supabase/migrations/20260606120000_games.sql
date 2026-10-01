-- ============================================================
-- Multiplayer games — rooms, seats, server-authoritative state
-- ============================================================
--
-- Security model (defense in depth, see AGENTS.md):
--   * game_states holds the FULL engine state (every hand, the RNG seed).
--     It has RLS enabled with NO policies → every client key is denied.
--     Only the service-role server (src/lib/supabase/admin.ts) reads/writes it.
--   * games / rooms / room_players / game_actions expose only public-safe data
--     and are client-readable so Supabase Realtime can push updates.
--   * Clients never receive raw state — only `view()` projections via API routes.
--   * All writes go through the service role (server-authoritative); clients
--     can never mutate game tables directly, even with a crafted request.
-- ============================================================

-- ── Rooms (lobby) ───────────────────────────────────────────
create table wildcard.rooms (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null,                 -- shareable invite code
  module_id   text not null,                        -- game module id, e.g. 'bataille'
  host_id     uuid not null references wildcard.profiles(id) on delete cascade,
  status      text not null default 'lobby'
                check (status in ('lobby', 'playing', 'finished')),
  created_at  timestamptz default now()
);

-- ── Seats ───────────────────────────────────────────────────
create table wildcard.room_players (
  room_id    uuid not null references wildcard.rooms(id) on delete cascade,
  user_id    uuid not null references wildcard.profiles(id) on delete cascade,
  seat       int not null,
  joined_at  timestamptz default now(),
  primary key (room_id, user_id),
  unique (room_id, seat)
);

-- ── Game (public meta) — safe to read; drives Realtime ──────
create table wildcard.games (
  id                 uuid primary key default gen_random_uuid(),
  room_id            uuid not null references wildcard.rooms(id) on delete cascade,
  module_id          text not null,
  version            int not null default 0,         -- bumped on every applied action (optimistic concurrency)
  phase              text not null,
  current_player_id  uuid,                            -- whose turn, or null (simultaneous/engine-driven)
  is_over            boolean not null default false,
  winner_ids         uuid[] not null default '{}',
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);

create index games_room_id_idx on wildcard.games(room_id);

-- Active game pointer on the room (added after games exists → no circular FK).
alter table wildcard.rooms
  add column current_game_id uuid references wildcard.games(id) on delete set null;

-- ── Game state (SECRET) — service-role only ─────────────────
create table wildcard.game_states (
  game_id     uuid primary key references wildcard.games(id) on delete cascade,
  state       jsonb not null,
  updated_at  timestamptz default now()
);

-- ── Action log (audit / replay) — public-safe ──────────────
create table wildcard.game_actions (
  id          bigint generated always as identity primary key,
  game_id     uuid not null references wildcard.games(id) on delete cascade,
  seq         int not null,
  actor_id    uuid not null,
  action      jsonb not null,
  created_at  timestamptz default now(),
  unique (game_id, seq)
);

create index game_actions_game_id_idx on wildcard.game_actions(game_id);

-- ============================================================
-- Row Level Security
-- ============================================================
alter table wildcard.rooms          enable row level security;
alter table wildcard.room_players   enable row level security;
alter table wildcard.games          enable row level security;
alter table wildcard.game_states    enable row level security;  -- no policies → deny all
alter table wildcard.game_actions   enable row level security;

-- Rooms: any authenticated user can browse/join; only the server mutates.
create policy "rooms are viewable by authenticated users"
  on wildcard.rooms for select
  using (auth.role() = 'authenticated');
create policy "only service role writes rooms"
  on wildcard.rooms for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- Seats: readable by authenticated users (lobby + board chrome); server writes.
create policy "seats are viewable by authenticated users"
  on wildcard.room_players for select
  using (auth.role() = 'authenticated');
create policy "only service role writes seats"
  on wildcard.room_players for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- Games (public meta): readable by authenticated users; server writes.
create policy "games meta is viewable by authenticated users"
  on wildcard.games for select
  using (auth.role() = 'authenticated');
create policy "only service role writes games"
  on wildcard.games for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- Action log: readable by authenticated users (replay/audit); server inserts.
create policy "game actions are viewable by authenticated users"
  on wildcard.game_actions for select
  using (auth.role() = 'authenticated');
create policy "only service role writes game actions"
  on wildcard.game_actions for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- game_states intentionally has NO policies: the secret state is reachable
-- only via the service role, which bypasses RLS.

-- ============================================================
-- Realtime
-- ============================================================
alter table wildcard.rooms          replica identity full;
alter table wildcard.room_players   replica identity full;
alter table wildcard.games          replica identity full;

alter publication supabase_realtime add table wildcard.rooms;
alter publication supabase_realtime add table wildcard.room_players;
alter publication supabase_realtime add table wildcard.games;
alter publication supabase_realtime add table wildcard.game_actions;
