import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CustomizeView } from "@/components/customize/CustomizeView";
import { requireAuthUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({
    params,
}: {
    params: Promise<{ lang: Locale }>;
}): Promise<Metadata> {
    const { lang } = await params;
    const t = await getTranslations({ locale: lang, namespace: "customize" });
    return { title: t("title"), description: t("subtitle") };
}

export default async function Page({
    params,
}: {
    params: Promise<{ lang: Locale }>;
}) {
    const { lang } = await params;
    setRequestLocale(lang);
    const user = await requireAuthUser(lang, `/${lang}/customize`);
    const supabase = await createClient();

    const [customizationRes, inventoryRes] = await Promise.all([
        supabase
            .from("player_customizations")
            .select("deck_style_id, board_style_id")
            .eq("user_id", user.id)
            .single(),
        supabase
            .from("player_inventory")
            .select("item_type, item_id")
            .eq("user_id", user.id),
    ]);

    const customization = customizationRes.data;
    const inventory = inventoryRes.data ?? [];

    const rawDeckIds = inventory
        .filter((i) => i.item_type === "deck_style")
        .map((i) => i.item_id);

    const rawBoardIds = inventory
        .filter((i) => i.item_type === "board_style")
        .map((i) => i.item_id);

    // Free defaults are always available regardless of inventory
    const ownedDeckStyleIds = [...new Set(["free", ...rawDeckIds])];
    const ownedBoardStyleIds = [...new Set(["green_felt", ...rawBoardIds])];

    return (
        <CustomizeView
            ownedDeckStyleIds={ownedDeckStyleIds}
            ownedBoardStyleIds={ownedBoardStyleIds}
            currentDeckStyleId={customization?.deck_style_id ?? "free"}
            currentBoardStyleId={customization?.board_style_id ?? "green_felt"}
        />
    );
}
