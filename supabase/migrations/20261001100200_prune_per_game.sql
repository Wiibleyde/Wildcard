-- ============================================================
-- Retention: prune move logs per GAME, under a schema-scoped job name
-- ============================================================
-- Two fixes to 20260619000000_prune_game_actions / 20260619120000:
--
--   1. The sweep deleted rows per action `created_at`: a long game straddling
--      the 15-day line lost its first moves and kept the last ones — a log with
--      a hole the replay cannot re-derive. A game's log is now deleted whole,
--      keyed on the game's own end (`games.updated_at`), and the game is stamped
--      `actions_pruned_at` so the replay says "expired" instead of guessing.
--
--   2. The pg_cron job was named 'prune-game-actions'. pg_cron is shared by the
--      whole instance, so the prod (`wildcard`) and dev twin schemas overwrote
--      each other's job. The name now carries the schema name, which the
--      migration runner rewrites per target (scripts/migrate.sh).
-- ============================================================

-- The sweep scans finished games by age.
create index if not exists games_over_updated_at_idx
  on wildcard.games (updated_at)
  where is_over and actions_pruned_at is null;

create or replace function wildcard.prune_expired_game_actions()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed integer;
begin
  with expired as (
    update wildcard.games g
      set actions_pruned_at = now()
      where g.is_over
        and g.actions_pruned_at is null
        and g.updated_at < now() - interval '15 days'
        and not exists (
          select 1 from wildcard.persistent_replays pr where pr.game_id = g.id
        )
      returning g.id
  )
  delete from wildcard.game_actions a
    using expired e
    where a.game_id = e.id;
  get diagnostics removed = row_count;
  return removed;
end;
$$;

-- Drop the old, unscoped job (whichever schema last claimed it); guarded so the
-- second schema to migrate does not fail on an already-removed job.
select cron.unschedule(jobid)
  from cron.job
  where jobname = 'prune-game-actions';

-- cron.schedule upserts by name. 03:17 daily, off-peak.
select cron.schedule(
  'wildcard-prune-game-actions',
  '17 3 * * *',
  $$select wildcard.prune_expired_game_actions();$$
);
