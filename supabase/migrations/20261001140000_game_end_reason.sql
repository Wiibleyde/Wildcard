-- ============================================================
-- How a game ended (natural / forfeit / admin / abandoned)
-- ============================================================
-- `games.is_over` alone cannot tell a finished game from one that was closed
-- out of band: a forfeit, an admin force-end and the maintenance reaper flip
-- the flag without touching the secret state, so `module.outcome(state)` is
-- null for them. The client then showed "ended by an administrator" to the
-- players who had just *won* by forfeit, the replay labelled forfeits as admin
-- ends, and the boot-time settlement retry lost the forfeit result (ELO/XP).
--
-- `end_reason` records it, written by the new code path only:
--   * 'natural'   — the module reached a terminal state (commit_game_step, or
--                   a game over at the deal);
--   * 'forfeit'   — a seated player left; `forfeited_by` names them and
--                   `winner_ids` holds everyone who stayed;
--   * 'admin'     — force-ended from the moderation dashboard (no result);
--   * 'abandoned' — closed by the maintenance reaper (bot-only / AFK, no result).
--
-- It doubles as the settlement-retry marker: settlePendingGames only retries
-- rows with a non-null end_reason, so a game ended by an old-code instance
-- during a rolling deploy (already settled the old way, settled_at NULL) is
-- never settled a second time.
-- ============================================================

alter table wildcard.games
  add column if not exists end_reason text,
  add column if not exists forfeited_by uuid;

alter table wildcard.games
  drop constraint if exists games_end_reason_check;
alter table wildcard.games
  add constraint games_end_reason_check
  check (
    end_reason is null
    or (is_over and end_reason in ('natural', 'forfeit', 'admin', 'abandoned'))
  );

alter table wildcard.games
  drop constraint if exists games_forfeited_by_check;
alter table wildcard.games
  add constraint games_forfeited_by_check
  check (forfeited_by is null or end_reason = 'forfeit');

-- ── commit_game_step: stamp a natural end ──────────────────
-- Same signature and body as 20261001100100_atomic_game_commit.sql, plus
-- `end_reason = 'natural'` on the move that finishes the game.
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
        end_reason        = case when p_is_over then 'natural' end,
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

-- Server-only (PUBLIC's built-in EXECUTE is re-granted on every create).
revoke execute on function wildcard.commit_game_step(
  uuid, integer, text, uuid, boolean, uuid[], jsonb, uuid, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function wildcard.commit_game_step(
  uuid, integer, text, uuid, boolean, uuid[], jsonb, uuid, jsonb, jsonb
) to service_role;
