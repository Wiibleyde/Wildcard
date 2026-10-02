import type { Locale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { CustomizePage } from "@/components/pages/CustomizePage";
import { requireAuthUser } from "@/lib/auth/session";
import {
    DEFAULT_BOARD_STYLE,
    DEFAULT_DECK_STYLE,
    getPlayerStyles,
} from "@/lib/models/customization";
import { createClient } from "@/lib/supabase/server";

export default async function Page({
    params,
}: {
    params: Promise<{ lang: Locale }>;
}) {
    const { lang } = await params;
    setRequestLocale(lang);
    const user = await requireAuthUser(lang, `/${lang}/customize`);
    const supabase = await createClient();

    const [styles, inventoryRes] = await Promise.all([
        getPlayerStyles(supabase, user.id),
        supabase
            .from("player_inventory")
            .select("item_type, item_id")
            .eq("user_id", user.id),
    ]);
    const inventory = inventoryRes.data ?? [];
    const idsOf = (type: "deck_style" | "board_style") =>
        inventory.filter((i) => i.item_type === type).map((i) => i.item_id);

    // The defaults are always equippable, whatever the inventory holds.
    const ownedDeckStyleIds = [
        ...new Set([DEFAULT_DECK_STYLE, ...idsOf("deck_style")]),
    ];
    const ownedBoardStyleIds = [
        ...new Set([DEFAULT_BOARD_STYLE, ...idsOf("board_style")]),
    ];

    return (
        <CustomizePage
            ownedDeckStyleIds={ownedDeckStyleIds}
            ownedBoardStyleIds={ownedBoardStyleIds}
            currentDeckStyleId={styles.deckStyleId}
            currentBoardStyleId={styles.boardStyleId}
        />
    );
}
