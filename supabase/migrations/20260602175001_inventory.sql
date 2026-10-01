-- ============================================================
-- Player inventory
-- Tracks which deck/board styles each player has unlocked.
-- ============================================================
create table wildcard.player_inventory (
  user_id     uuid not null references wildcard.profiles(id) on delete cascade,
  item_type   text not null check (item_type in ('deck_style', 'board_style')),
  item_id     text not null,
  acquired_at timestamptz default now(),
  primary key (user_id, item_type, item_id)
);

alter table wildcard.player_inventory enable row level security;

-- Players can only see their own inventory
create policy "players can view their own inventory"
  on wildcard.player_inventory for select
  using (auth.uid() = user_id);

-- Only service role can grant items (purchases, rewards, admin)
create policy "only service role can insert inventory"
  on wildcard.player_inventory for insert
  with check (auth.role() = 'service_role');

create policy "only service role can delete inventory"
  on wildcard.player_inventory for delete
  using (auth.role() = 'service_role');

-- ============================================================
-- Realtime
-- ============================================================
alter table wildcard.player_inventory replica identity full;

alter publication supabase_realtime add table wildcard.player_inventory;

-- ============================================================
-- Auto-grant all free-tier items when a profile is created.
-- Queries the catalogs so any future free items are also granted.
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
  where tier = 'free';

  insert into wildcard.player_inventory (user_id, item_type, item_id)
  select new.id, 'board_style', id
  from wildcard.board_styles
  where tier = 'free';

  return new;
end;
$$;

create trigger on_profile_created_inventory
  after insert on wildcard.profiles
  for each row execute procedure wildcard.handle_new_profile_inventory();

-- ============================================================
-- Backfill: grant free items to all existing profiles
-- ============================================================
insert into wildcard.player_inventory (user_id, item_type, item_id)
select p.id, 'deck_style', ds.id
from wildcard.profiles p
cross join wildcard.deck_styles ds
where ds.tier = 'free'
on conflict do nothing;

insert into wildcard.player_inventory (user_id, item_type, item_id)
select p.id, 'board_style', bs.id
from wildcard.profiles p
cross join wildcard.board_styles bs
where bs.tier = 'free'
on conflict do nothing;
