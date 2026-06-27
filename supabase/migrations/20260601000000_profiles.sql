-- ============================================================
-- Profiles
-- ============================================================
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text unique not null,
  avatar_url  text,
  created_at  timestamptz default now()
);

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.profiles enable row level security;

-- Anyone can read profiles (leaderboard, chat, lobby)
create policy "profiles are viewable by everyone"
  on public.profiles for select
  using (true);

-- Users can only insert their own profile
create policy "users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Users can only update their own profile
create policy "users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- ============================================================
-- Realtime
-- ============================================================
alter table public.profiles replica identity full;

alter publication supabase_realtime add table public.profiles;

-- ============================================================
-- Auto-create profile on sign-up (Discord / Google / email)
-- Username derived from OAuth metadata with uniqueness enforcement
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  base_username text;
  final_username text;
  counter       int := 0;
begin
  -- Discord sends user_name, Google sends name
  base_username := coalesce(
    new.raw_user_meta_data->>'user_name',
    new.raw_user_meta_data->>'name',
    split_part(coalesce(new.email, ''), '@', 1),
    'joueur'
  );

  -- Sanitize: lowercase, non-alphanumeric → underscore, max 20 chars
  base_username := lower(regexp_replace(base_username, '[^a-z0-9_]', '_', 'g'));
  base_username := substr(base_username, 1, 20);
  -- Remove leading/trailing underscores
  base_username := trim(both '_' from base_username);
  -- Fallback if empty after sanitization
  if base_username = '' then
    base_username := 'joueur';
  end if;

  final_username := base_username;

  -- Ensure uniqueness
  while exists (select 1 from public.profiles where username = final_username) loop
    counter := counter + 1;
    final_username := base_username || '_' || counter;
  end loop;

  insert into public.profiles (id, username)
  values (new.id, final_username);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
