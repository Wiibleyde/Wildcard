-- ============================================================
-- Lobby roles — player vs spectator
-- ============================================================
--
-- A lobby member is now either a *player* (dealt into the game, occupies a
-- seat) or a *spectator* (watches the live game read-only, holds no seat).
-- Spectators stay in `room_players` so Realtime pushes the roster, the
-- host-reassign / empty-lobby reaping logic keeps working, and the lobby can
-- list who is watching. The server reads `view(state, null)` for them — the
-- in-code RLS that already redacts every private hand (see AGENTS.md).
-- ============================================================

alter table public.room_players
  add column role text not null default 'player'
    check (role in ('player', 'spectator'));

-- Spectators occupy no seat.
alter table public.room_players
  alter column seat drop not null;

-- Seat uniqueness applies to players only; spectators carry a null seat.
alter table public.room_players
  drop constraint if exists room_players_room_id_seat_key;

create unique index room_players_seat_unique
  on public.room_players (room_id, seat)
  where role = 'player';
