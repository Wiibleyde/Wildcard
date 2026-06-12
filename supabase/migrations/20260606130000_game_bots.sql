-- ============================================================
-- Bots — fill a lobby with computer players
-- ============================================================
-- Bots are NOT real users: they have no auth.users / profiles row. They exist
-- only as synthetic uuid players inside the engine state, and are driven
-- server-side (see advanceBots in src/lib/models/game.ts). `rooms.bot_count`
-- is how many to add at deal time; `games.bot_ids` records which player ids in
-- the state are bots so the server knows whose turns to auto-play.
-- ============================================================

alter table public.rooms
  add column bot_count int not null default 0 check (bot_count >= 0);

alter table public.games
  add column bot_ids uuid[] not null default '{}';
