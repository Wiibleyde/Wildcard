-- ============================================================
-- ECA games — moderation lock
-- ============================================================
--
-- An admin take-down (unpublish from the moderation panel) used to set
-- `status = 'draft'` only — and the owner could re-publish immediately,
-- undoing the moderation. `moderation_locked` records the take-down:
--
--   * set   by the admin unpublish (adminSetEcaStatus → 'draft'),
--   * cleared by the admin restore (adminSetEcaStatus → 'published'),
--   * while set, the studio API refuses the owner's publish
--     (`moderation_locked`) — the owner may still edit the draft, so the
--     offending content can be fixed before an admin restores it.
--
-- The CHECK makes the invariant hold in the database too (defense in depth):
-- a locked game can never be in the published catalog, whatever write path
-- a future bug might open.
-- ============================================================

alter table wildcard.eca_games
  add column if not exists moderation_locked boolean not null default false;

alter table wildcard.eca_games
  drop constraint if exists eca_games_locked_not_published;

alter table wildcard.eca_games
  add constraint eca_games_locked_not_published
    check (not moderation_locked or status = 'draft');
