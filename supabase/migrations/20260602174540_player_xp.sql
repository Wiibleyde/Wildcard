-- ============================================================
-- Player XP
-- ============================================================
create table wildcard.player_xp (
  user_id     uuid primary key references wildcard.profiles(id) on delete cascade,
  xp          integer not null default 0 check (xp >= 0),
  updated_at  timestamptz default now()
);

-- ============================================================
-- Row Level Security
-- ============================================================
alter table wildcard.player_xp enable row level security;

-- Anyone can read XP (leaderboard)
create policy "player_xp are viewable by everyone"
  on wildcard.player_xp for select
  using (true);

-- Only service role can mutate XP — no direct client writes
create policy "only service role can insert player_xp"
  on wildcard.player_xp for insert
  with check (auth.role() = 'service_role');

create policy "only service role can update player_xp"
  on wildcard.player_xp for update
  using (auth.role() = 'service_role');

-- ============================================================
-- Realtime
-- ============================================================
alter table wildcard.player_xp replica identity full;

alter publication supabase_realtime add table wildcard.player_xp;

-- ============================================================
-- Auto-create XP row when profile is created
-- ============================================================
create or replace function wildcard.handle_new_profile()
returns trigger
language plpgsql
security definer set search_path = wildcard
as $$
begin
  insert into wildcard.player_xp (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_profile_created
  after insert on wildcard.profiles
  for each row execute procedure wildcard.handle_new_profile();

-- ============================================================
-- XP helpers (security definer — bypass RLS, server-side only)
-- ============================================================

-- Increment XP. Returns new xp value.
create or replace function wildcard.increment_xp(p_user_id uuid, p_amount integer)
returns integer
language plpgsql
security definer set search_path = wildcard
as $$
declare
  new_xp integer;
begin
  if p_amount <= 0 then
    raise exception 'p_amount must be positive (got %)', p_amount;
  end if;

  update wildcard.player_xp
  set xp = xp + p_amount,
      updated_at = now()
  where user_id = p_user_id
  returning xp into new_xp;

  if not found then
    raise exception 'player_xp row not found for user %', p_user_id;
  end if;

  return new_xp;
end;
$$;

-- Decrement XP, floored at 0. Returns new xp value.
create or replace function wildcard.decrement_xp(p_user_id uuid, p_amount integer)
returns integer
language plpgsql
security definer set search_path = wildcard
as $$
declare
  new_xp integer;
begin
  if p_amount <= 0 then
    raise exception 'p_amount must be positive (got %)', p_amount;
  end if;

  update wildcard.player_xp
  set xp = greatest(0, xp - p_amount),
      updated_at = now()
  where user_id = p_user_id
  returning xp into new_xp;

  if not found then
    raise exception 'player_xp row not found for user %', p_user_id;
  end if;

  return new_xp;
end;
$$;
