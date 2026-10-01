-- ============================================================
-- Profiles
-- ============================================================
-- Game-side profile: one row per account, the anchor every per-player table
-- (xp, elo, inventory, rooms…) references. Identity — pseudo and avatar — is NOT
-- stored here: it belongs to the portal (`portal.profiles`) and is read through
-- `wildcard.player_identities` (see the shared_auth migration).
create table wildcard.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  created_at  timestamptz default now()
);

-- ============================================================
-- Row Level Security
-- ============================================================
alter table wildcard.profiles enable row level security;

-- Anyone can read profiles (leaderboard, chat, lobby). There is nothing to
-- write from a client: rows come from the sign-up trigger only.
create policy "profiles are viewable by everyone"
  on wildcard.profiles for select
  using (true);

-- ============================================================
-- Realtime
-- ============================================================
alter table wildcard.profiles replica identity full;

alter publication supabase_realtime add table wildcard.profiles;

-- ============================================================
-- Auto-create the game profile on sign-up
-- ============================================================
-- Every account of the shared auth gets a Wildcard profile: the game is open to
-- any portal user, no per-project claim required. The trigger name carries the
-- schema name so `wildcard` and `wildcard_dev` each own their own trigger on
-- the shared auth.users.
create or replace function wildcard.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = wildcard
as $$
begin
  insert into wildcard.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

grant execute on function wildcard.handle_new_user() to supabase_auth_admin;

drop trigger if exists on_auth_user_wildcard on auth.users;
create trigger on_auth_user_wildcard
  after insert on auth.users
  for each row execute function wildcard.handle_new_user();
