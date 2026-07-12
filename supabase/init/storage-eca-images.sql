-- ============================================================
-- Storage: eca-images bucket + RLS
-- ============================================================
-- Cover images for Game Studio (ECA) creations. Same rationale as
-- storage-avatars.sql: applied by the `storage-init` one-shot AFTER
-- supabase-storage has migrated its own schema — these `storage.objects`
-- policies must NOT live in supabase/migrations/ (creating them before the
-- storage-schema migration makes foldername(text) undroppable and deadlocks
-- the migration). Idempotent so re-running `up` is safe.
--
-- Writes are keyed to a top-level folder equal to the uploader's uid, exactly
-- like avatars: the browser client uploads to `${ownerId}/${gameId}.${ext}`,
-- so a creator can only write cover images under their own folder. Reads are
-- public — a cover image describes a game, it is not secret.

insert into storage.buckets (id, name, public)
values ('eca-images', 'eca-images', true)
on conflict (id) do nothing;

drop policy if exists "eca images are publicly readable"        on storage.objects;
drop policy if exists "users can upload their own eca image"    on storage.objects;
drop policy if exists "users can update their own eca image"    on storage.objects;
drop policy if exists "users can delete their own eca image"    on storage.objects;

create policy "eca images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'eca-images');

create policy "users can upload their own eca image"
  on storage.objects for insert
  with check (
    bucket_id = 'eca-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "users can update their own eca image"
  on storage.objects for update
  using (
    bucket_id = 'eca-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "users can delete their own eca image"
  on storage.objects for delete
  using (
    bucket_id = 'eca-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
