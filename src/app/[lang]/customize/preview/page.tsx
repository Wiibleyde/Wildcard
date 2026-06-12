import { redirect } from "next/navigation";
import type { Locale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { PreviewPage } from "@/components/pages/PreviewPage";
import { BOARD_THEMES } from "@/lib/board/themes";
import { THEMES } from "@/lib/card/themes";
import { createClient } from "@/lib/supabase/server";

export default async function Page({
    params,
    searchParams,
}: {
    params: Promise<{ lang: Locale }>;
    searchParams: Promise<{ deck?: string; board?: string }>;
}) {
    const { lang } = await params;
    setRequestLocale(lang);
    const { deck, board } = await searchParams;

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect(`/${lang}/login`);

    // Resolve IDs: prefer query params, fall back to player's current customization
    let deckId = deck && THEMES[deck] ? deck : null;
    let boardId = board && BOARD_THEMES[board] ? board : null;

    if (!deckId || !boardId) {
        const { data: custom } = await supabase
            .from("player_customizations")
            .select("deck_style_id, board_style_id")
            .eq("user_id", user.id)
            .single();
        deckId ??= custom?.deck_style_id ?? "free";
        boardId ??= custom?.board_style_id ?? "green_felt";
    }

    return (
        <PreviewPage deckId={deckId} boardId={boardId} backHref="/customize" />
    );
}
