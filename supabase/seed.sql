-- ============================================================
-- Local dev seed — applied by `supabase db reset` (bun run dev:up --fresh)
-- ============================================================
-- Two email/password accounts (password: password123):
--   dev@local.test    — admin, pseudo "dev"
--   player@local.test — plain player, pseudo "player"
-- Sign in with `bun run dev:login [email]`, which mints the session cookie the
-- portal would set in prod. The auth.users inserts fire the sign-up triggers
-- (portal stub + wildcard), so profiles, xp, inventory and roles are created
-- exactly as for a real account. UUIDs must be valid v4 (GoTrue checks).
-- ============================================================

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
values
  (
    '00000000-0000-0000-0000-000000000000', 'd0d0d0d0-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'dev@local.test',
    crypt('password123', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000', 'd0d0d0d0-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'player@local.test',
    crypt('password123', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
  );

insert into auth.identities (
  id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
)
select gen_random_uuid(), u.id, u.id::text,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', now(), now(), now()
from auth.users u
where u.email in ('dev@local.test', 'player@local.test');

-- Identity as the portal would hold it.
update portal.profiles set pseudo = 'dev' where id = 'd0d0d0d0-0000-4000-8000-000000000001';
update portal.profiles set pseudo = 'player' where id = 'd0d0d0d0-0000-4000-8000-000000000002';

update wildcard.user_roles set role = 'admin' where user_id = 'd0d0d0d0-0000-4000-8000-000000000001';
