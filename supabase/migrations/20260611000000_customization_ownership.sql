-- ============================================================
-- Defense in depth: enforce style ownership at the database level.
--
-- PATCH /api/customization already verifies player_inventory before
-- writing, but the previous RLS policies let any authenticated user
-- equip ANY catalog style by calling PostgREST directly with their own
-- session (the policies only checked row ownership). Mirror the
-- application rule in RLS: a style is equippable when it is common-tier
-- (granted to everyone) or present in the player's inventory.
--
-- The signup trigger (handle_new_profile_customization) is SECURITY
-- DEFINER and runs as the table owner, so it bypasses RLS and keeps
-- working with the column defaults.
-- ============================================================

create or replace function public.can_equip_deck_style(p_style_id text)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1 from public.deck_styles
    where id = p_style_id and tier = 'common'
  ) or exists (
    select 1 from public.player_inventory
    where user_id = auth.uid()
      and item_type = 'deck_style'
      and item_id = p_style_id
  );
$$;

create or replace function public.can_equip_board_style(p_style_id text)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1 from public.board_styles
    where id = p_style_id and tier = 'common'
  ) or exists (
    select 1 from public.player_inventory
    where user_id = auth.uid()
      and item_type = 'board_style'
      and item_id = p_style_id
  );
$$;

drop policy "users can insert their own customizations"
  on public.player_customizations;
drop policy "users can update their own customizations"
  on public.player_customizations;

create policy "users can insert their own customizations"
  on public.player_customizations for insert
  with check (
    auth.uid() = user_id
    and public.can_equip_deck_style(deck_style_id)
    and public.can_equip_board_style(board_style_id)
  );

create policy "users can update their own customizations"
  on public.player_customizations for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and public.can_equip_deck_style(deck_style_id)
    and public.can_equip_board_style(board_style_id)
  );
