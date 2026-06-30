-- ============================================================
-- Private rooms are members-only at the RLS layer
-- ============================================================
-- 20260628120000 added rooms.visibility but nothing consumed it: a 'private'
-- room (every hand-made room) was still SELECT-able by any authenticated user,
-- so the column described an intent the database did not enforce. This wires
-- visibility to the read policy — defence in depth alongside the invite-code
-- flow, in the same spirit as the rest of the project's RLS.
--
--   * public  — matchmaker rooms: readable by anyone (transient, auto-joined
--     via the ticket, never browsed by code).
--   * private — readable only by its members. Host, players and spectators are
--     all seated in room_players by the service role *before* the client ever
--     reads the room row (createRoom / joinRoom run server-side, then navigate),
--     so the join-by-code flow keeps working; only a non-member peeking at a
--     room id they were never invited to is now denied.
-- ============================================================

drop policy "rooms are viewable by authenticated users" on public.rooms;

create policy "rooms are viewable by members or when public"
  on public.rooms for select
  using (
    visibility = 'public'
    or auth.uid() in (
      select rp.user_id
      from public.room_players rp
      where rp.room_id = rooms.id
    )
  );
