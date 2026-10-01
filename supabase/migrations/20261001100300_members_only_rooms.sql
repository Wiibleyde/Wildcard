-- ============================================================
-- Private rooms: members-only games + seats; no join after the deal
-- ============================================================
-- 20260630120000 made private `rooms` rows members-only, but `games` and
-- `room_players` stayed readable (and Realtime-subscribable) by every
-- authenticated user: anyone could list who sits in which private room and
-- which game id it plays. Both now follow the room's rule — readable when the
-- room is public or the viewer is a member.
--
-- The rule lives in one SECURITY DEFINER helper: a `room_players` policy that
-- queried `room_players` (or `rooms`, whose policy queries `room_players`) would
-- recurse. The helper reads both tables as their owner and answers one boolean
-- for the caller's own uid.
--
-- Clients only ever read their own room (lobby page, useRoomRefresh, the
-- useRoomChannel / useGameChannel doorbells), so members keep everything they
-- need. Staff watching a game they are not seated in go through the service
-- role API and fall back to polling.
-- ============================================================

create or replace function wildcard.can_read_room(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
           select 1 from wildcard.rooms r
           where r.id = p_room_id and r.visibility = 'public'
         )
      or exists (
           select 1 from wildcard.room_players rp
           where rp.room_id = p_room_id
             and rp.user_id = (select auth.uid())
         );
$$;

-- Policies are evaluated with the caller's privileges: the helper must stay
-- executable by the API roles (it only answers for the caller's own uid).
revoke execute on function wildcard.can_read_room(uuid) from public;
grant execute on function wildcard.can_read_room(uuid) to anon, authenticated, service_role;

drop policy if exists "rooms are viewable by members or when public" on wildcard.rooms;
create policy "rooms are viewable by members or when public"
  on wildcard.rooms for select
  using (wildcard.can_read_room(id));

drop policy if exists "seats are viewable by authenticated users" on wildcard.room_players;
create policy "seats are viewable by room members or when public"
  on wildcard.room_players for select
  using (auth.role() = 'authenticated' and wildcard.can_read_room(room_id));

drop policy if exists "games meta is viewable by authenticated users" on wildcard.games;
create policy "games meta is viewable by room members or when public"
  on wildcard.games for select
  using (auth.role() = 'authenticated' and wildcard.can_read_room(room_id));

-- ── Seats only change while the room is a lobby ─────────────
-- joinRoom / setRoomRole checked `status = 'lobby'` and then inserted in a
-- second statement, so a join could land between startGame's claim and its
-- seat read — a player seated in a room whose game was dealt without them.
-- This trigger makes the check atomic with the write: it takes a share lock on
-- the room row, which startGame's `lobby → playing` update needs exclusively,
-- so the two serialise and the loser sees the other's result. Error code
-- WCL01 is mapped to `already_started` by src/lib/models/room.ts.
create or replace function wildcard.guard_room_players_lobby()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_status text;
begin
  select r.status into v_status
    from wildcard.rooms r
    where r.id = new.room_id
    for share;
  if v_status is distinct from 'lobby' then
    raise exception 'room % is not in the lobby', new.room_id
      using errcode = 'WCL01';
  end if;
  return new;
end;
$$;

drop trigger if exists room_players_lobby_only on wildcard.room_players;
create trigger room_players_lobby_only
  before insert or update on wildcard.room_players
  for each row execute function wildcard.guard_room_players_lobby();
