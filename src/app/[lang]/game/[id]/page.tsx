import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { GamePlayClient } from "@/components/game/GamePlayClient";
import { requireAuthUser } from "@/lib/auth/session";
import { canViewGame } from "@/lib/models/access";
import { getPlayerStyles } from "@/lib/models/customization";
import { getGameClientState } from "@/lib/models/game/payload";
import { identityOf, nameTag } from "@/lib/models/identities";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export default async function Page({
    params,
}: {
    params: Promise<{ lang: Locale; id: string }>;
}) {
    const { lang, id } = await params;
    setRequestLocale(lang);

    const user = await requireAuthUser(lang, `/${lang}/game/${id}`);
    const supabase = await createClient();

    // Service-role read (RLS does not apply): authorize first, like the game API.
    const admin = createAdminClient();
    if (!(await canViewGame(admin, id, user.id))) notFound();
    const result = await getGameClientState(admin, id, user.id);
    if (!result.ok) {
        if (result.error === "not_found") notFound();
        throw new Error(`game ${id} failed to load: ${result.error}`);
    }

    const [styles, viewer, tCommon] = await Promise.all([
        getPlayerStyles(supabase, user.id),
        // Spectators are not in the seated roster but still need a chat name.
        identityOf(supabase, user.id),
        getTranslations("common"),
    ]);

    return (
        <div className="min-h-screen px-4 xl:px-10 pt-6 pb-6">
            <GamePlayClient
                initial={result.payload}
                currentUserId={user.id}
                currentUserName={
                    viewer.name ??
                    tCommon("player_fallback", { tag: nameTag(user.id) })
                }
                deckStyleId={styles.deckStyleId}
                boardStyleId={styles.boardStyleId}
            />
        </div>
    );
}
