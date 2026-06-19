-- ============================================================
-- Retention: prune game action logs after 15 days
-- ============================================================
--
-- `game_actions` is the per-move audit/replay log. It is the largest, fastest
-- growing table (dozens of rows per game) and is only needed for the 15-day
-- replay window — the durable result (winner, module, date) lives on `games`
-- and is never pruned, so history + ELO are unaffected.
--
-- A daily pg_cron job deletes the moves of FINISHED games older than 15 days.
-- We never touch live games: deleting a still-playing game's log would break
-- crash-recovery and spectator catch-up, which both re-derive from it.
-- ============================================================

create extension if not exists pg_cron;

-- The sweep filters on age, so index the column it scans.
create index if not exists game_actions_created_at_idx
  on public.game_actions (created_at);

-- Single source of truth for the retention rule — callable by the cron job and
-- by hand. SECURITY DEFINER so the cron role can delete regardless of RLS.
create or replace function public.prune_expired_game_actions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  removed integer;
begin
  delete from public.game_actions a
  using public.games g
  where a.game_id = g.id
    and g.is_over
    and a.created_at < now() - interval '15 days';
  get diagnostics removed = row_count;
  return removed;
end;
$$;

-- Schedule (idempotent: cron.schedule upserts by job name). 03:17 daily, off-peak.
select cron.schedule(
  'prune-game-actions',
  '17 3 * * *',
  $$select public.prune_expired_game_actions();$$
);
