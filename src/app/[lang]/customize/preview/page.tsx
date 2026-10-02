import type { Locale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { PreviewPage } from "@/components/pages/PreviewPage";
import { requireAuthUser } from "@/lib/auth/session";
import { BOARD_THEMES } from "@/lib/board/themes";
import { THEMES } from "@/lib/card/themes";
import { getPlayerStyles } from "@/lib/models/customization";
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

    const user = await requireAuthUser(lang, `/${lang}/customize/preview`);

    let deckId = deck && THEMES[deck] ? deck : null;
    let boardId = board && BOARD_THEMES[board] ? board : null;

    if (!deckId || !boardId) {
        const styles = await getPlayerStyles(await createClient(), user.id);
        deckId ??= styles.deckStyleId;
        boardId ??= styles.boardStyleId;
    }

    return (
        <PreviewPage deckId={deckId} boardId={boardId} backHref="/customize" />
    );
}
