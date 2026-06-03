import { redirect } from "next/navigation";
import { CustomizePage } from "@/components/pages/CustomizePage";
import { getDictionary } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";

export default async function Page({
    params,
}: {
    params: Promise<{ lang: string }>;
}) {
    const { lang } = await params;
    const dict = await getDictionary(lang);

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect(`/${lang}/login`);

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

    const ownedDeckStyleIds = inventory
        .filter((i) => i.item_type === "deck_style")
        .map((i) => i.item_id);

    const ownedBoardStyleIds = inventory
        .filter((i) => i.item_type === "board_style")
        .map((i) => i.item_id);

    return (
        <CustomizePage
            lang={lang}
            ownedDeckStyleIds={ownedDeckStyleIds}
            ownedBoardStyleIds={ownedBoardStyleIds}
            currentDeckStyleId={customization?.deck_style_id ?? "free"}
            currentBoardStyleId={customization?.board_style_id ?? "green_felt"}
            dict={dict}
        />
    );
}
