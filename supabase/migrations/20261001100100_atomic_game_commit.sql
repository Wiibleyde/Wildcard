-- ============================================================
-- Atomic game commits + idempotent settlement
-- ============================================================
-- A move used to be committed in three PostgREST calls: a compare-and-set on
-- games.version, then the game_states write, then the game_actions insert. A
-- crash or a failed write between them left a torn game (version N+1 with state
-- N, or a state with no log row → the replay diverges), and a reader could load
-- meta and state from two different versions.
--
-- `commit_game_step` does the three writes in ONE transaction: the CAS on the
-- meta row, the secret state, and the log row (seq = new version). It returns
-- the new version, or NULL when the CAS lost (stale version, game over or
-- missing) — in which case nothing was written.
--
-- `settle_game` records the end of a game exactly once: it flips
-- `games.settled_at` with a compare-and-set, finishes the room, and applies the
-- ELO / XP the server computed — all in the same transaction. A retried or
-- concurrent settlement is a no-op, so ratings can never be applied twice.
--
-- Both functions are SECURITY INVOKER and reserved to the service role (see
-- 20261001109000_lock_down_functions.sql): the API routes call them after the
-- engine has validated the move.
-- ============================================================

-- When the game's end was recorded (room finished, ELO/XP applied). NULL on a
-- finished game = settlement still owed (the maintenance sweep retries it).
alter table wildcard.games
  add column if not exists settled_at timestamptz;

-- When the retention sweep deleted this game's move log. Distinguishes "replay
-- expired" from "the game never had a move" (e.g. force-ended at the deal).
alter table wildcard.games
  add column if not exists actions_pruned_at timestamptz;

-- Every game finished before this migration was settled by the old code path
-- (best-effort) — never settle it again.
update wildcard.games
  set settled_at = coalesce(updated_at, now())
  where is_over and settled_at is null;

-- Finished games whose log is already gone were pruned by the old per-action
-- sweep (legacy rows cannot tell "pruned" from "zero moves"; assume pruned).
update wildcard.games g
  set actions_pruned_at = now()
  where g.is_over
    and g.version > 0
    and g.actions_pruned_at is null
    and not exists (
      select 1 from wildcard.game_actions a where a.game_id = g.id
    );

-- ── One move = one transaction ─────────────────────────────
create or replace function wildcard.commit_game_step(
  p_game_id           uuid,
  p_expected_version  integer,
  p_phase             text,
  p_current_player_id uuid,
  p_is_over           boolean,
  p_winner_ids        uuid[],
  p_state             jsonb,
  p_actor_id          uuid,
  p_action            jsonb,
  p_events            jsonb
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_version integer;
begin
  update wildcard.games
    set version           = version + 1,
        phase             = p_phase,
        current_player_id = p_current_player_id,
        is_over           = p_is_over,
        winner_ids        = coalesce(p_winner_ids, '{}'),
        updated_at        = now()
    where id = p_game_id
      and version = p_expected_version
      and not is_over
    returning version into v_version;

  if v_version is null then
    return null; -- lost the race (or the game ended): nothing written
  end if;

  update wildcard.game_states
    set state = p_state, updated_at = now()
    where game_id = p_game_id;
  if not found then
    raise exception 'game_states row missing for game %', p_game_id;
  end if;

  insert into wildcard.game_actions (game_id, seq, actor_id, action, events)
    values (p_game_id, v_version, p_actor_id, p_action,
            coalesce(p_events, '[]'::jsonb));

  return v_version;
end;
$$;

-- ── End of game, recorded exactly once ─────────────────────
create or replace function wildcard.settle_game(
  p_game_id uuid,
  p_elo     jsonb,
  p_xp      jsonb
)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_module text;
  v_room   uuid;
begin
  update wildcard.games
    set settled_at = now()
    where id = p_game_id
      and is_over
      and settled_at is null
    returning module_id, room_id into v_module, v_room;

  if v_module is null then
    return false; -- not over yet, or already settled
  end if;

  update wildcard.rooms set status = 'finished' where id = v_room;

  if p_elo is not null and jsonb_array_length(p_elo) > 0 then
    perform wildcard.apply_elo_results(v_module, p_elo);
  end if;
  if p_xp is not null and jsonb_array_length(p_xp) > 0 then
    perform wildcard.award_game_xp(p_xp);
  end if;

  return true;
end;
$$;
