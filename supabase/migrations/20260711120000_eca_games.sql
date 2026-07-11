-- ============================================================
-- ECA games — Game Studio definitions (Événement / Condition / Action)
-- ============================================================
--
-- Studio-created game definitions: each row stores one creator-authored
-- rule set as a plain JSON document (`definition`), interpreted at play
-- time by `src/lib/eca` into a regular GameModule.
--
-- Security model (consistent with games / rooms, see AGENTS.md):
--   * Writes are server-authoritative: every insert/update/delete flows
--     through API routes on the service role — no client key can write.
--   * The `definition` JSON is validated in the API layer
--     (validateEcaDefinition) before any write, and re-validated before
--     play. The CHECK constraints below only guard the cheap scalar
--     invariants; the deep structural validation lives in code.
--   * Clients may read their own rows (draft or not) and anyone's
--     published rows — definitions are not secret, they describe a game.
-- ============================================================

create table public.eca_games (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 60),
  description text check (description is null or char_length(description) <= 300),
  definition  jsonb not null,
  status      text not null default 'draft'
                check (status in ('draft', 'published')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- The Studio hub lists "my games" — index the owner lookup.
create index eca_games_owner_id_idx on public.eca_games(owner_id);
-- Browsing the published catalog only ever scans published rows.
create index eca_games_status_idx on public.eca_games(status)
  where status = 'published';

-- ── Per-owner cap (20) — enforced in the DB as defense in depth ─────────────
-- The API surfaces a clean error, but this trigger is the source of truth:
-- a per-owner advisory lock closes the check-then-insert race so two
-- parallel creates can never both squeak past a stale count.
create or replace function public.enforce_eca_games_cap()
returns trigger
language plpgsql
as $$
begin
  perform pg_advisory_xact_lock(hashtext('eca_games:' || new.owner_id::text));
  if (select count(*) from public.eca_games where owner_id = new.owner_id) >= 20 then
    raise exception 'eca games cap reached (max 20)'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger eca_games_cap
  before insert on public.eca_games
  for each row execute function public.enforce_eca_games_cap();

-- ── RLS: owner + published reads, service-role-only writes ──────────────────
alter table public.eca_games enable row level security;

create policy "owners read their games and anyone reads published games"
  on public.eca_games for select
  using (
    auth.uid() = owner_id
    or (status = 'published' and auth.role() = 'authenticated')
  );

create policy "only service role writes eca games"
  on public.eca_games for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
