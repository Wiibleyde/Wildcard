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
create table wildcard.user_roles (
  user_id     uuid primary key references wildcard.profiles(id) on delete cascade,
  role        text not null default 'user'
                check (role in ('user', 'moderator', 'admin')),
  granted_at  timestamptz default now()
);

alter table wildcard.user_roles enable row level security;

-- A user may read their OWN role (the nav shows the admin entry, the admin
-- pages gate on it). Nobody can read other users' roles from the client, and
-- nobody can write: promotions happen via the service role only.
create policy "users can read their own role"
  on wildcard.user_roles for select
  using (auth.uid() = user_id);

create policy "only service role writes roles"
  on wildcard.user_roles for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- Backfill every existing profile with the default 'user' role.
insert into wildcard.user_roles (user_id)
  select id from wildcard.profiles
  on conflict (user_id) do nothing;

-- Extend the sign-up trigger so new accounts get a role row too. The profile
-- is inserted first (same function), so the FK is satisfied.
create or replace function wildcard.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = wildcard
as $$
begin
  insert into wildcard.profiles (id) values (new.id) on conflict (id) do nothing;
  insert into wildcard.user_roles (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;

-- ── App settings (singleton: maintenance switch) ────────────
-- A one-row table keyed by a constant `true` so there is exactly one settings
-- row to read and update — no "which row?" ambiguity.
create table wildcard.app_settings (
  id                   boolean primary key default true check (id),
  maintenance          boolean not null default false,
  maintenance_message  text,
  updated_at           timestamptz default now(),
  updated_by           uuid references wildcard.profiles(id) on delete set null
);

insert into wildcard.app_settings (id) values (true);

alter table wildcard.app_settings enable row level security;

-- Readable by anyone (the proxy must consult it on every navigation, including
-- for signed-out visitors hitting public pages). Only the service role writes.
create policy "app settings are readable by everyone"
  on wildcard.app_settings for select
  using (true);

create policy "only service role writes app settings"
  on wildcard.app_settings for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- ============================================================
-- Granting the first admin (run once, manually, after migrating):
--
--   update wildcard.user_roles
--     set role = 'admin'
--     where user_id = (select id from auth.users where email = 'YOUR_EMAIL');
-- ============================================================
