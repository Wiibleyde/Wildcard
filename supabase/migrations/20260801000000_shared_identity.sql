-- ============================================================
-- Shared identity — portal profiles, storage, backfill
-- ============================================================
-- Wildcard runs on the shared Supabase of the wiibleyde.dev infra. Sign-in and
-- identity belong to the portal (auth.wiibleyde.dev): pseudo and avatar live in
-- `portal.profiles`, avatars in the portal's public `avatars` bucket.
-- ============================================================

-- ── Player identities ───────────────────────────────────────
-- The portal's RLS only lets a user read their own profile (and friends'), but
-- a game shows other players: lobby roster, chat names, deal-time names, the
-- studio's creator names. This SECURITY DEFINER function is the single, narrow
-- window onto `portal.profiles`: given ids, it returns their pseudo and avatar
-- path, and nothing else. `search_path = ''` + qualified names: a definer
-- function must not resolve objects through the caller's path.
create or replace function wildcard.player_identities(p_ids uuid[])
returns table (id uuid, pseudo text, avatar_path text)
language sql
stable
security definer
set search_path = ''
as $$
  select pp.id, pp.pseudo, pp.avatar_path
  from portal.profiles pp
  where pp.id = any (p_ids);
$$;

revoke execute on function wildcard.player_identities(uuid[]) from public, anon;
grant execute on function wildcard.player_identities(uuid[]) to authenticated, service_role;

-- ── Storage: ECA cover images ───────────────────────────────
-- Bucket and policy names carry the schema name: storage.buckets and
-- storage.objects are shared by every app of the instance, and the migration
-- runner renames them for `wildcard_dev`. Writes are keyed to a top-level folder
-- equal to the uploader's uid (`${ownerId}/${gameId}.${ext}`); reads are public
-- — a cover image describes a game, it is not secret.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'wildcard-eca-images', 'wildcard-eca-images', true, 5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

drop policy if exists "wildcard: eca images public read" on storage.objects;
drop policy if exists "wildcard: eca images upload own" on storage.objects;
drop policy if exists "wildcard: eca images update own" on storage.objects;
drop policy if exists "wildcard: eca images delete own" on storage.objects;

create policy "wildcard: eca images public read"
  on storage.objects for select
  using (bucket_id = 'wildcard-eca-images');

create policy "wildcard: eca images upload own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'wildcard-eca-images'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

create policy "wildcard: eca images update own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'wildcard-eca-images'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

create policy "wildcard: eca images delete own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'wildcard-eca-images'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

-- ── Backfill ────────────────────────────────────────────────
-- Accounts that existed before Wildcard joined the shared auth get their game
-- profile now. Inserting the profile fires the per-profile triggers (xp,
-- customizations, inventory); roles are filled by hand since that insert lives
-- in the auth.users trigger.
insert into wildcard.profiles (id)
  select u.id from auth.users u
  on conflict (id) do nothing;

insert into wildcard.user_roles (user_id)
  select p.id from wildcard.profiles p
  on conflict (user_id) do nothing;
