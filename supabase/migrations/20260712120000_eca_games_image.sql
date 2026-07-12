-- ============================================================
-- ECA games — optional cover image
-- ============================================================
--
-- Adds `image_url` to `eca_games`: a storage PATH (not a URL) into the public
-- `eca-images` bucket, following the same convention as `profiles.avatar_url`.
-- The creator uploads the file directly from the browser (RLS keys writes to
-- their own `${uid}/…` folder — see supabase/init/storage-eca-images.sql);
-- the path is then persisted here through the studio API on the service role.
-- Rendered by rebuilding the public URL with `publicStorageUrl('eca-images', …)`.
--
-- Nullable — a game without a cover is the default. The length CHECK only
-- guards a runaway string; the meaningful shape (owner-prefixed path) is
-- enforced in the API layer (updateEcaGame).
-- ============================================================

alter table public.eca_games
  add column if not exists image_url text
    check (image_url is null or char_length(image_url) <= 2048);
