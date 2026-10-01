-- ============================================================
-- Portal stub — LOCAL DEVELOPMENT ONLY
-- ============================================================
-- On the shared infra, identity (pseudo, avatar) belongs to the portal
-- (auth.wiibleyde.dev) and lives in `portal.profiles`, owned by the portal
-- stack. Wildcard only reads it, through security-definer functions.
--
-- A local Supabase has no portal, so this creates a minimal look-alike with the
-- same columns — ONLY when the `portal` schema does not exist. On the shared
-- stack the guard makes this file a no-op: Wildcard never creates or alters
-- anything in the portal's schema.
-- ============================================================
do $$
begin
  if to_regnamespace('portal') is null then
    create schema portal;
    grant usage on schema portal to authenticated, service_role, supabase_auth_admin;

    create table portal.profiles (
      id          uuid primary key references auth.users(id) on delete cascade,
      pseudo      text check (pseudo ~ '^[A-Za-z0-9._-]{3,24}$'),
      avatar_path text,
      created_at  timestamptz not null default now(),
      updated_at  timestamptz not null default now()
    );
    create unique index profiles_pseudo_lower_key on portal.profiles (lower(pseudo));

    alter table portal.profiles enable row level security;
    grant select on portal.profiles to authenticated, service_role;
    create policy "profiles: read own" on portal.profiles
      for select to authenticated using ((select auth.uid()) = id);

    -- Like the real portal: every account gets a profile row at sign-up.
    create function portal.handle_new_user()
    returns trigger language plpgsql security definer set search_path = '' as $f$
    begin
      insert into portal.profiles (id) values (new.id) on conflict (id) do nothing;
      return new;
    end;
    $f$;
    grant execute on function portal.handle_new_user() to supabase_auth_admin;

    create trigger on_auth_user_portal
      after insert on auth.users
      for each row execute function portal.handle_new_user();
  end if;
end
$$;
