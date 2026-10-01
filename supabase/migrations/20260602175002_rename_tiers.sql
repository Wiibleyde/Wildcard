-- ============================================================
-- Replace old tier names with RPG rarity ladder:
--   free     → common
--   premium  → epic
--   exclusive→ legendary
--   collab   → mystical
-- New tiers added: uncommon, rare, ethereal (top tier, quasi-unique)
-- ============================================================

-- Drop old check constraints
alter table wildcard.deck_styles
  drop constraint deck_styles_tier_check;
alter table wildcard.board_styles
  drop constraint board_styles_tier_check;

-- Migrate existing rows
update wildcard.deck_styles  set tier = 'common'   where tier = 'free';
update wildcard.deck_styles  set tier = 'epic'      where tier = 'premium';
update wildcard.deck_styles  set tier = 'legendary' where tier = 'exclusive';
update wildcard.deck_styles  set tier = 'mystical'  where tier = 'collab';

update wildcard.board_styles set tier = 'common'   where tier = 'free';
update wildcard.board_styles set tier = 'epic'      where tier = 'premium';
update wildcard.board_styles set tier = 'legendary' where tier = 'exclusive';
update wildcard.board_styles set tier = 'mystical'  where tier = 'collab';

-- Re-seed existing catalog items with correct new tiers
update wildcard.deck_styles set tier = 'common'    where id = 'free';
update wildcard.deck_styles set tier = 'rare'       where id = 'dark';
update wildcard.deck_styles set tier = 'epic'       where id = 'neon';
update wildcard.deck_styles set tier = 'uncommon'   where id = 'nature';

update wildcard.board_styles set tier = 'common'    where id = 'green_felt';
update wildcard.board_styles set tier = 'rare'       where id = 'dark_wood';
update wildcard.board_styles set tier = 'epic'       where id = 'ocean';
update wildcard.board_styles set tier = 'legendary'  where id = 'midnight';

-- Add new check constraints with full ladder
alter table wildcard.deck_styles
  add constraint deck_styles_tier_check
    check (tier in ('common','uncommon','rare','epic','legendary','mystical','ethereal'));

alter table wildcard.board_styles
  add constraint board_styles_tier_check
    check (tier in ('common','uncommon','rare','epic','legendary','mystical','ethereal'));

-- ============================================================
-- Fix inventory trigger: auto-grant 'common' (was 'free')
-- The function already queries tier = 'free' → update to 'common'
-- ============================================================
create or replace function wildcard.handle_new_profile_inventory()
returns trigger
language plpgsql
security definer set search_path = wildcard
as $$
begin
  insert into wildcard.player_inventory (user_id, item_type, item_id)
  select new.id, 'deck_style', id
  from wildcard.deck_styles
  where tier = 'common';

  insert into wildcard.player_inventory (user_id, item_type, item_id)
  select new.id, 'board_style', id
  from wildcard.board_styles
  where tier = 'common';

  return new;
end;
$$;

-- ============================================================
-- Creator deck & board — ethereal tier (top, quasi-unique)
-- ============================================================
insert into wildcard.deck_styles (id, name, tier, preview_css) values
  ('creator', 'Fondateur', 'ethereal',
   '{"backgroundColor":"#05050a","backColor":"#05050a","borderColor":"#e8c468"}')
on conflict (id) do update set tier = 'ethereal';

insert into wildcard.board_styles (id, name, tier, background_css) values
  ('creator', 'Fondateur', 'ethereal',
   'radial-gradient(ellipse at 30% 20%, rgba(232,196,104,0.12) 0%, transparent 60%), radial-gradient(ellipse at 70% 80%, rgba(139,92,246,0.10) 0%, transparent 60%), linear-gradient(160deg, #05050a 0%, #0d0b18 50%, #05050a 100%)')
on conflict (id) do update set tier = 'ethereal';

-- ============================================================
-- Grant function — run once after creator account is created:
--   SELECT wildcard.grant_creator_items('nathan.bnl33@gmail.com');
-- ============================================================
create or replace function wildcard.grant_creator_items(p_email text)
returns void
language plpgsql
security definer set search_path = wildcard
as $$
declare
  v_user_id uuid;
begin
  select id into v_user_id
  from auth.users
  where email = p_email
  limit 1;

  if v_user_id is null then
    raise exception 'No user found with email %', p_email;
  end if;

  insert into wildcard.player_inventory (user_id, item_type, item_id)
  values
    (v_user_id, 'deck_style',  'creator'),
    (v_user_id, 'board_style', 'creator')
  on conflict do nothing;
end;
$$;

revoke execute on function wildcard.grant_creator_items(text) from public, anon, authenticated;
