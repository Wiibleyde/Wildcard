import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    deck_style_id?: string;
    board_style_id?: string;
  };

  if (!body.deck_style_id && !body.board_style_id) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  // Validate ownership for each field being updated
  if (body.deck_style_id) {
    const { data: owned } = await supabase
      .from("player_inventory")
      .select("item_id")
      .eq("user_id", user.id)
      .eq("item_type", "deck_style")
      .eq("item_id", body.deck_style_id)
      .single();
    if (!owned) {
      return NextResponse.json(
        { error: "deck_style_not_owned" },
        { status: 403 },
      );
    }
  }

  if (body.board_style_id) {
    const { data: owned } = await supabase
      .from("player_inventory")
      .select("item_id")
      .eq("user_id", user.id)
      .eq("item_type", "board_style")
      .eq("item_id", body.board_style_id)
      .single();
    if (!owned) {
      return NextResponse.json(
        { error: "board_style_not_owned" },
        { status: 403 },
      );
    }
  }

  // Read current row so upsert always has all NOT NULL fields
  const { data: current } = await supabase
    .from("player_customizations")
    .select("deck_style_id, board_style_id")
    .eq("user_id", user.id)
    .single();

  const { error } = await supabase.from("player_customizations").upsert(
    {
      user_id: user.id,
      deck_style_id: body.deck_style_id ?? current?.deck_style_id ?? "free",
      board_style_id:
        body.board_style_id ?? current?.board_style_id ?? "green_felt",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    console.error("[PATCH /api/customization]", error.code, error.message);
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
