import { createClient } from "@/lib/supabase/client";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

export type DeckStyle = Database["public"]["Tables"]["deck_styles"]["Row"];
export type BoardStyle = Database["public"]["Tables"]["board_styles"]["Row"];
export type PlayerCustomization =
  Database["public"]["Tables"]["player_customizations"]["Row"];

// ── Client-side helpers ───────────────────────────────────────────────────────

export async function getPlayerCustomization(
  userId: string,
): Promise<PlayerCustomization | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("player_customizations")
    .select("*")
    .eq("user_id", userId)
    .single();
  return data;
}

export async function updateDeckStyle(
  userId: string,
  deckStyleId: string,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("player_customizations")
    .update({
      deck_style_id: deckStyleId,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
  if (error) throw error;
}

export async function updateBoardStyle(
  userId: string,
  boardStyleId: string,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("player_customizations")
    .update({
      board_style_id: boardStyleId,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
  if (error) throw error;
}

export async function listDeckStyles(): Promise<DeckStyle[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("deck_styles")
    .select("*")
    .order("tier")
    .order("name");
  return data ?? [];
}

export async function listBoardStyles(): Promise<BoardStyle[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("board_styles")
    .select("*")
    .order("tier")
    .order("name");
  return data ?? [];
}

// ── In-game: resolve deck style for multiple players at once ─────────────────

export async function getPlayersDeckStyles(
  userIds: string[],
): Promise<Record<string, string>> {
  if (userIds.length === 0) return {};
  const supabase = createClient();
  const { data } = await supabase
    .from("player_customizations")
    .select("user_id, deck_style_id")
    .in("user_id", userIds);
  const map: Record<string, string> = {};
  for (const row of data ?? []) {
    map[row.user_id] = row.deck_style_id;
  }
  // Default fallback for players without a row (shouldn't happen post-trigger)
  for (const id of userIds) {
    if (!map[id]) map[id] = "free";
  }
  return map;
}

// ── Server-side helpers ───────────────────────────────────────────────────────

export async function getPlayerCustomizationServer(
  userId: string,
): Promise<PlayerCustomization | null> {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("player_customizations")
    .select("*")
    .eq("user_id", userId)
    .single();
  return data;
}
