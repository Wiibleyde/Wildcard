-- ============================================================
-- Room rules — host-configurable game options
-- ============================================================
-- Each game module declares its lobby toggles (GameModule.ruleToggles, e.g.
-- Président's « le 2 ferme le pli », « ou rien », « révolution »…). The host
-- flips them in the lobby; the chosen set is stored here as a { key: boolean }
-- map and bound into the module at deal time (GameModule.withRules, see
-- startGame). Empty '{}' means "use every default".
--
-- No new RLS policy: rules ride the existing `rooms` row, readable by clients
-- under the current select policy and Realtime publication. Writes go through
-- the service-role admin client, which gates host + lobby status in code
-- (see setRules in src/lib/models/room.ts).
-- ============================================================

alter table public.rooms
  add column rules jsonb not null default '{}'::jsonb;
