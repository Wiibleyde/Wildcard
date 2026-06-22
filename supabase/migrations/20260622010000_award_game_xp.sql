-- ============================================================
-- Award XP for a finished game (atomic, server-side)
-- ============================================================
-- Adds each participant's XP for one finished game in a single transaction.
-- `p_awards` is a JSON array of {user_id, amount}; the amount is computed
-- server-side (src/lib/xp) from the game outcome — participation plus a win
-- bonus. Unlike `increment_xp`, this creates a missing row instead of raising,
-- so it is safe even before the profile's auto-seed trigger has run. Bots carry
-- no profile and are filtered out by the caller.
create or replace function public.award_game_xp(p_awards jsonb)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  a jsonb;
begin
  for a in select value from jsonb_array_elements(p_awards)
  loop
    insert into public.player_xp (user_id, xp)
    values (
      (a->>'user_id')::uuid,
      greatest(0, (a->>'amount')::int)
    )
    on conflict (user_id) do update
    set xp         = public.player_xp.xp + greatest(0, (a->>'amount')::int),
        updated_at = now();
  end loop;
end;
$$;
