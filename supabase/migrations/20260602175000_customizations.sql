-- ============================================================
-- Deck styles catalog
-- ============================================================
create table wildcard.deck_styles (
  id          text primary key,
  name        text not null,
  tier        text not null default 'free'
                check (tier in ('free', 'premium', 'exclusive', 'collab')),
  preview_css jsonb,
  created_at  timestamptz default now()
);

alter table wildcard.deck_styles enable row level security;

-- Catalog is public read-only
create policy "deck_styles are viewable by everyone"
  on wildcard.deck_styles for select
  using (true);

-- Only service role modifies the catalog
create policy "only service role can insert deck_styles"
  on wildcard.deck_styles for insert
  with check (auth.role() = 'service_role');

create policy "only service role can update deck_styles"
  on wildcard.deck_styles for update
  using (auth.role() = 'service_role');

-- ============================================================
-- Board styles catalog
-- ============================================================
create table wildcard.board_styles (
  id             text primary key,
  name           text not null,
  tier           text not null default 'free'
                   check (tier in ('free', 'premium', 'exclusive', 'collab')),
  background_css text not null,
  created_at     timestamptz default now()
);

alter table wildcard.board_styles enable row level security;

create policy "board_styles are viewable by everyone"
  on wildcard.board_styles for select
  using (true);

create policy "only service role can insert board_styles"
  on wildcard.board_styles for insert
  with check (auth.role() = 'service_role');

create policy "only service role can update board_styles"
  on wildcard.board_styles for update
  using (auth.role() = 'service_role');

-- ============================================================
-- Seed catalog
-- ============================================================
insert into wildcard.deck_styles (id, name, tier, preview_css) values
  ('free',    'Classique', 'free',    '{"backgroundColor":"#ffffff","backColor":"#1e3a8a"}'),
  ('dark',    'Sombre',    'premium', '{"backgroundColor":"#1f2937","backColor":"#111827"}'),
  ('neon',    'Néon',      'premium', '{"backgroundColor":"#0f172a","backColor":"#4f46e5"}'),
  ('nature',  'Nature',    'premium', '{"backgroundColor":"#f0fdf4","backColor":"#166534"}');

insert into wildcard.board_styles (id, name, tier, background_css) values
  ('green_felt', 'Tapis vert', 'free',    'radial-gradient(ellipse at center, #166534 0%, #14532d 60%, #0f4024 100%)'),
  ('dark_wood',  'Bois sombre','premium', 'repeating-linear-gradient(90deg,#292524 0px,#292524 4px,#1c1917 4px,#1c1917 20px)'),
  ('ocean',      'Océan',      'premium', 'radial-gradient(ellipse at center, #0c4a6e 0%, #075985 50%, #0369a1 100%)'),
  ('midnight',   'Minuit',     'premium', 'radial-gradient(ellipse at top, #1e1b4b 0%, #0f0f23 60%, #000000 100%)');

-- ============================================================
-- Player customizations
-- ============================================================
create table wildcard.player_customizations (
  user_id        uuid primary key references wildcard.profiles(id) on delete cascade,
  deck_style_id  text not null default 'free' references wildcard.deck_styles(id),
  board_style_id text not null default 'green_felt' references wildcard.board_styles(id),
  updated_at     timestamptz default now()
);

alter table wildcard.player_customizations enable row level security;

-- deck_style_id must be readable by all authenticated users —
-- opponents need it to render your cards with your chosen style during a game.
-- board_style_id has no sensitivity; visible to others is harmless.
create policy "customizations are viewable by authenticated users"
  on wildcard.player_customizations for select
  using (auth.role() = 'authenticated');

create policy "users can insert their own customizations"
  on wildcard.player_customizations for insert
  with check (auth.uid() = user_id);

create policy "users can update their own customizations"
  on wildcard.player_customizations for update
  using (auth.uid() = user_id);

-- ============================================================
-- Realtime
-- ============================================================
alter table wildcard.player_customizations replica identity full;

alter publication supabase_realtime add table wildcard.player_customizations;

-- ============================================================
-- Auto-create customization row when profile is created
-- ============================================================
create or replace function wildcard.handle_new_profile_customization()
returns trigger
language plpgsql
security definer set search_path = wildcard
as $$
begin
  insert into wildcard.player_customizations (user_id)
  values (new.id);
  return new;
end;
$$;

create trigger on_profile_created_customization
  after insert on wildcard.profiles
  for each row execute procedure wildcard.handle_new_profile_customization();
