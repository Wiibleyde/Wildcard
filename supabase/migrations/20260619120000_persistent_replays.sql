-- ============================================================
-- Persistent replays — opt out of the 15-day move retention
-- ============================================================
--
-- The daily sweep (20260619000000_prune_game_actions) deletes the move log
-- (`game_actions`) of finished games after 15 days. A player can *pin* up to 5
-- games to keep their move log forever, so the replay never expires.
--
-- Pins are per-account and capped, so the protected set stays bounded
-- (≤ 5 games per user). The durable result (winner / date) always lives on
-- `games` and is never pruned regardless — this table only governs whether the
-- per-move replay frames survive the sweep.
-- ============================================================

create table public.persistent_replays (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  game_id    uuid not null references public.games(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, game_id)
);

-- The sweep asks "is this game pinned by anyone" — index the lookup column.
create index persistent_replays_game_id_idx on public.persistent_replays(game_id);

-- ── Per-account cap (5) — enforced in the DB as defense in depth ────────────
-- The API pre-checks the cap for a clean error, but this trigger is the source
-- of truth: a per-user advisory lock closes the check-then-insert race so two
-- parallel pins can never both squeak past a stale count.
create or replace function public.enforce_persistent_replay_cap()
returns trigger
language plpgsql
as $$
begin
  perform pg_advisory_xact_lock(hashtext('persistent_replays:' || new.user_id::text));
  if (select count(*) from public.persistent_replays where user_id = new.user_id) >= 5 then
    raise exception 'persistent replay cap reached (max 5)'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger persistent_replays_cap
  before insert on public.persistent_replays
  for each row execute function public.enforce_persistent_replay_cap();

-- ── RLS: service-role only, like every other game table ─────────────────────
-- All access flows through API routes on the service role, which check
-- participation + cap before writing. No client policy → clients are denied
-- direct access, consistent with games / game_actions / game_states.
alter table public.persistent_replays enable row level security;
create policy "only service role writes persistent replays"
  on public.persistent_replays for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- ── Retention: never prune a pinned game's moves ────────────────────────────
-- Redefine the sweep to skip any game that at least one player has pinned.
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
    and a.created_at < now() - interval '15 days'
    and not exists (
      select 1 from public.persistent_replays pr where pr.game_id = a.game_id
    );
  get diagnostics removed = row_count;
  return removed;
end;
$$;
