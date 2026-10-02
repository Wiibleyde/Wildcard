import type { SupabaseClient } from "@supabase/supabase-js";
import { isJsonObject } from "@/lib/json";
import { INSUFFICIENT_PRIVILEGE } from "@/lib/supabase/pgErrors";
import type { Database } from "@/lib/supabase/types";

type Client = SupabaseClient<Database>;

/** Column defaults of `player_customizations`. */
export const DEFAULT_DECK_STYLE = "free";
export const DEFAULT_BOARD_STYLE = "green_felt";

export interface PlayerStyles {
    readonly deckStyleId: string;
    readonly boardStyleId: string;
}

/** The player's equipped styles; defaults when unset or unreadable (cosmetic). */
export async function getPlayerStyles(
    supabase: Client,
    userId: string,
): Promise<PlayerStyles> {
    const { data, error } = await supabase
        .from("player_customizations")
        .select("deck_style_id, board_style_id")
        .eq("user_id", userId)
        .maybeSingle();
    if (error) {
        console.error("[customization] styles read failed:", error.message);
    }
    return {
        deckStyleId: data?.deck_style_id ?? DEFAULT_DECK_STYLE,
        boardStyleId: data?.board_style_id ?? DEFAULT_BOARD_STYLE,
    };
}

export interface CustomizationPatch {
    deck_style_id?: string;
    board_style_id?: string;
}

export type CustomizationPatchErrorCode =
    | "nothing_to_update"
    | "deck_style_not_owned"
    | "board_style_not_owned"
    | "db_error";

export const CUSTOMIZATION_ERROR_STATUS: Record<
    CustomizationPatchErrorCode,
    number
> = {
    nothing_to_update: 400,
    deck_style_not_owned: 403,
    board_style_not_owned: 403,
    db_error: 500,
};

const STYLE_ID_MAX_LENGTH = 64;

function isStyleId(value: unknown): value is string {
    return (
        typeof value === "string" &&
        value.length > 0 &&
        value.length <= STYLE_ID_MAX_LENGTH
    );
}

/** `null` when the body is not a valid patch. */
export function parseCustomizationPatch(
    body: unknown,
): CustomizationPatch | null {
    if (!isJsonObject(body)) return null;
    const patch: CustomizationPatch = {};
    if ("deck_style_id" in body) {
        if (!isStyleId(body.deck_style_id)) return null;
        patch.deck_style_id = body.deck_style_id;
    }
    if ("board_style_id" in body) {
        if (!isStyleId(body.board_style_id)) return null;
        patch.board_style_id = body.board_style_id;
    }
    return patch;
}

type PatchResult =
    | { ok: true }
    | { ok: false; error: CustomizationPatchErrorCode; message?: string };

const CAN_EQUIP = {
    deck: "can_equip_deck_style",
    board: "can_equip_board_style",
} as const;

/**
 * Asks the same SQL function the RLS policy evaluates (common tier or owned),
 * so the clean 403 and the database rule cannot drift.
 */
async function canEquip(
    supabase: Client,
    kind: keyof typeof CAN_EQUIP,
    styleId: string,
): Promise<{ ok: true; allowed: boolean } | { ok: false; message: string }> {
    const { data, error } = await supabase.rpc(CAN_EQUIP[kind], {
        p_style_id: styleId,
    });
    if (error) return { ok: false, message: error.message };
    return { ok: true, allowed: data === true };
}

/** Runs with the caller's RLS client: the policy is the final authority. */
export async function patchCustomization(
    supabase: Client,
    userId: string,
    input: CustomizationPatch,
): Promise<PatchResult> {
    if (!input.deck_style_id && !input.board_style_id) {
        return { ok: false, error: "nothing_to_update" };
    }

    for (const [kind, styleId, notOwned] of [
        ["deck", input.deck_style_id, "deck_style_not_owned"],
        ["board", input.board_style_id, "board_style_not_owned"],
    ] as const) {
        if (!styleId) continue;
        const check = await canEquip(supabase, kind, styleId);
        if (!check.ok) {
            return { ok: false, error: "db_error", message: check.message };
        }
        if (!check.allowed) return { ok: false, error: notOwned };
    }

    // Only the provided columns: a missing row gets the column defaults.
    const { error } = await supabase.from("player_customizations").upsert(
        {
            user_id: userId,
            ...(input.deck_style_id
                ? { deck_style_id: input.deck_style_id }
                : {}),
            ...(input.board_style_id
                ? { board_style_id: input.board_style_id }
                : {}),
            updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
    );
    if (error?.code === INSUFFICIENT_PRIVILEGE) {
        return {
            ok: false,
            error: input.deck_style_id
                ? "deck_style_not_owned"
                : "board_style_not_owned",
        };
    }
    if (error) return { ok: false, error: "db_error", message: error.message };
    return { ok: true };
}
