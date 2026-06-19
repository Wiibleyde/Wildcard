-- ============================================================
-- Admin & moderator modules — global roles + app maintenance flag
-- ============================================================
--
-- Two new concerns, both security-sensitive (see AGENTS.md → Auth & Sécurité):
--
--   1. A *global* role per user: user < moderator < admin. This is distinct
--      from `room_players.role` (player/spectator), which is per-lobby. It
--      lives in its own table — NOT a column on `profiles` — because profiles
--      carry a "users can update their own profile" RLS policy: a column there
--      would let any client promote itself to admin. `user_roles` has no client
--      write policy at all, so the role is mutable only through the service
--      role (server-authoritative, same model as game_states).
--
--   2. A global maintenance switch. When on, the proxy (src/proxy.ts) serves a
--      maintenance page to everyone except admins, who keep full access so they
--      can verify the app before lifting it.
-- ============================================================

-- ── Global roles ────────────────────────────────────────────
create table public.user_roles (
  user_id     uuid primary key references public.profiles(id) on delete cascade,
  role        text not null default 'user'
                check (role in ('user', 'moderator', 'admin')),
  granted_at  timestamptz default now()
);

alter table public.user_roles enable row level security;

-- A user may read their OWN role (the nav shows the admin entry, the admin
-- pages gate on it). Nobody can read other users' roles from the client, and
-- nobody can write: promotions happen via the service role only.
create policy "users can read their own role"
  on public.user_roles for select
  using (auth.uid() = user_id);

create policy "only service role writes roles"
  on public.user_roles for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- Backfill every existing profile with the default 'user' role.
insert into public.user_roles (user_id)
  select id from public.profiles
  on conflict (user_id) do nothing;

-- Extend the sign-up trigger so new accounts get a role row too. The profile
-- is inserted first (same function), so the FK is satisfied.
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
  base_username := coalesce(
    new.raw_user_meta_data->>'user_name',
    new.raw_user_meta_data->>'name',
    split_part(coalesce(new.email, ''), '@', 1),
    'joueur'
  );

  base_username := lower(regexp_replace(base_username, '[^a-z0-9_]', '_', 'g'));
  base_username := substr(base_username, 1, 20);
  base_username := trim(both '_' from base_username);
  if base_username = '' then
    base_username := 'joueur';
  end if;

  final_username := base_username;

  while exists (select 1 from public.profiles where username = final_username) loop
    counter := counter + 1;
    final_username := base_username || '_' || counter;
  end loop;

  insert into public.profiles (id, username)
  values (new.id, final_username);

  insert into public.user_roles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- ── App settings (singleton: maintenance switch) ────────────
-- A one-row table keyed by a constant `true` so there is exactly one settings
-- row to read and update — no "which row?" ambiguity.
create table public.app_settings (
  id                   boolean primary key default true check (id),
  maintenance          boolean not null default false,
  maintenance_message  text,
  updated_at           timestamptz default now(),
  updated_by           uuid references public.profiles(id) on delete set null
);

insert into public.app_settings (id) values (true);

alter table public.app_settings enable row level security;

-- Readable by anyone (the proxy must consult it on every navigation, including
-- for signed-out visitors hitting public pages). Only the service role writes.
create policy "app settings are readable by everyone"
  on public.app_settings for select
  using (true);

create policy "only service role writes app settings"
  on public.app_settings for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- ============================================================
-- Granting the first admin (run once, manually, after migrating):
--
--   update public.user_roles
--     set role = 'admin'
--     where user_id = (select id from public.profiles where username = 'YOUR_NAME');
-- ============================================================
