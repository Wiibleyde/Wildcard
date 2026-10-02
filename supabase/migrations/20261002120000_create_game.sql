-- ============================================================
-- Atomic deal: game meta + secret state + room pointer
-- ============================================================
-- startGame used to write the `games` row, then `game_states`, then
-- `rooms.current_game_id` in three calls, undoing the earlier writes by hand
-- when a later one failed. A crash in between left an orphan game or a room
-- pointing nowhere. `create_game` does the three writes in one transaction.
--
-- The room must already be claimed (`status = 'playing'`, set by startGame's
-- compare-and-set): otherwise nothing is written and an exception is raised.
-- Returns the new game's `created_at`.
-- ============================================================

create or replace function wildcard.create_game(
  p_game_id           uuid,
  p_room_id           uuid,
  p_module_id         text,
  p_phase             text,
  p_current_player_id uuid,
  p_is_over           boolean,
  p_winner_ids        uuid[],
  p_bot_ids           uuid[],
  p_state             jsonb
)
returns timestamptz
language plpgsql
set search_path = ''
as $$
declare
  v_created_at timestamptz;
begin
  insert into wildcard.games (
    id, room_id, module_id, phase, current_player_id, is_over,
    end_reason, winner_ids, version, bot_ids
  )
  values (
    p_game_id, p_room_id, p_module_id, p_phase, p_current_player_id, p_is_over,
    case when p_is_over then 'natural' end,
    coalesce(p_winner_ids, '{}'), 0, coalesce(p_bot_ids, '{}')
  )
  returning created_at into v_created_at;

  insert into wildcard.game_states (game_id, state)
    values (p_game_id, p_state);

  update wildcard.rooms
    set current_game_id = p_game_id
    where id = p_room_id
      and status = 'playing';
  if not found then
    raise exception 'room % is not claimed for a deal', p_room_id;
  end if;

  return v_created_at;
end;
$$;

-- Server-only (PUBLIC's built-in EXECUTE is re-granted on every create).
revoke execute on function wildcard.create_game(
  uuid, uuid, text, text, uuid, boolean, uuid[], uuid[], jsonb
) from public, anon, authenticated;
grant execute on function wildcard.create_game(
  uuid, uuid, text, text, uuid, boolean, uuid[], uuid[], jsonb
) to service_role;
