import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export interface CustomizationPatch {
    deck_style_id?: string;
    board_style_id?: string;
}

export type CustomizationPatchErrorCode =
    | "nothing_to_update"
    | "deck_style_not_owned"
    | "board_style_not_owned"
    | "db_error";

/** Catalog ids are short slugs — anything longer is garbage input. */
const STYLE_ID_MAX_LENGTH = 64;

function isStyleId(value: unknown): value is string {
    return (
        typeof value === "string" &&
        value.length > 0 &&
        value.length <= STYLE_ID_MAX_LENGTH
    );
}

/**
 * Narrow an unknown request body into a {@link CustomizationPatch}, or `null`
 * when the shape is invalid. The API boundary must never trust a client cast.
 */
export function parseCustomizationPatch(
    body: unknown,
): CustomizationPatch | null {
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
        return null;
    }
    const record = body as Record<string, unknown>;
    const patch: CustomizationPatch = {};

    if ("deck_style_id" in record) {
        if (!isStyleId(record.deck_style_id)) return null;
        patch.deck_style_id = record.deck_style_id;
    }

    if ("board_style_id" in record) {
        if (!isStyleId(record.board_style_id)) return null;
        patch.board_style_id = record.board_style_id;
    }

    return patch;
}

type PatchResult =
    | { ok: true }
    | { ok: false; error: CustomizationPatchErrorCode; message?: string };

const FREE_DEFAULTS: Record<"deck_style" | "board_style", string> = {
    deck_style: "free",
    board_style: "green_felt",
};

async function ownsStyle(
    supabase: SupabaseClient<Database>,
    userId: string,
    itemType: "deck_style" | "board_style",
    itemId: string,
): Promise<boolean> {
    if (itemId === FREE_DEFAULTS[itemType]) return true;
    const { data } = await supabase
        .from("player_inventory")
        .select("item_id")
        .eq("user_id", userId)
        .eq("item_type", itemType)
        .eq("item_id", itemId)
        .single();
    return !!data;
}

export async function patchCustomization(
    supabase: SupabaseClient<Database>,
    userId: string,
    input: CustomizationPatch,
): Promise<PatchResult> {
    if (!input.deck_style_id && !input.board_style_id) {
        return { ok: false, error: "nothing_to_update" };
    }

    if (input.deck_style_id) {
        const owns = await ownsStyle(
            supabase,
            userId,
            "deck_style",
            input.deck_style_id,
        );
        if (!owns) return { ok: false, error: "deck_style_not_owned" };
    }

    if (input.board_style_id) {
        const owns = await ownsStyle(
            supabase,
            userId,
            "board_style",
            input.board_style_id,
        );
        if (!owns) return { ok: false, error: "board_style_not_owned" };
    }

    const { data: current } = await supabase
        .from("player_customizations")
        .select("deck_style_id, board_style_id")
        .eq("user_id", userId)
        .single();

    const { error } = await supabase.from("player_customizations").upsert(
        {
            user_id: userId,
            deck_style_id:
                input.deck_style_id ?? current?.deck_style_id ?? "free",
            board_style_id:
                input.board_style_id ?? current?.board_style_id ?? "green_felt",
            updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
    );

    if (error) return { ok: false, error: "db_error", message: error.message };
    return { ok: true };
}
