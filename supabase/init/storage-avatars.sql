-- ============================================================
-- Storage: avatars bucket + RLS
-- ============================================================
-- Applied by the `storage-init` one-shot AFTER supabase-storage has run its own
-- schema migrations. It must NOT live in supabase/migrations/: db-migrate runs
-- before storage-api migrates, and creating these policies first makes
-- foldername(text) undroppable, which permanently blocks the storage-schema
-- migration ("cannot drop function foldername(text) because other objects
-- depend on it"). Idempotent so re-running `up` is safe.

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatars are publicly readable"       on storage.objects;
drop policy if exists "users can upload their own avatar"   on storage.objects;
drop policy if exists "users can update their own avatar"   on storage.objects;
drop policy if exists "users can delete their own avatar"   on storage.objects;

create policy "avatars are publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "users can upload their own avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "users can update their own avatar"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "users can delete their own avatar"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
