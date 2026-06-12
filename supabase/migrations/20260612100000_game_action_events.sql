-- ============================================================
-- Game history feed — persist the semantic events of each action
-- ============================================================
--
-- `apply()` already returns events ("played 2×8", "trick cleared",
-- "revolution"…) but they were only handed back to the acting client.
-- Storing them on the action log lets every client (and late joiners)
-- render a user-friendly history of the game.
--
-- Events are PUBLIC-SAFE by contract: modules must only emit facts that
-- are visible on the table anyway — never hidden-hand information. The
-- game_actions table is readable by any authenticated user (audit/replay),
-- so this column inherits that exposure deliberately.

alter table public.game_actions
  add column events jsonb not null default '[]'::jsonb;
