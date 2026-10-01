import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { GamePlayClient } from "@/components/game/GamePlayClient";
import { requireAuthUser } from "@/lib/auth/session";
import { canViewGame } from "@/lib/models/access";
import { getGameClientState } from "@/lib/models/game";
import { identityOf } from "@/lib/models/identities";
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

    // Service-role read: secret state stays server-side; client gets only the redacted view().
    // RLS does not apply to it, so authorize first — same rule as the game API.
    const admin = createAdminClient();
    if (!(await canViewGame(admin, id, user.id))) notFound();
    const result = await getGameClientState(admin, id, user.id);
    if (!result.ok) notFound();

    const [{ data: custom }, viewer] = await Promise.all([
        supabase
            .from("player_customizations")
            .select("deck_style_id, board_style_id")
            .eq("user_id", user.id)
            .maybeSingle(),
        // Viewer's own name — needed for chat even when they're a spectator (not a seated player).
        identityOf(supabase, user.id),
    ]);

    return (
        <div className="min-h-screen px-4 xl:px-10 pt-6 pb-6">
            <GamePlayClient
                initial={result.payload}
                currentUserId={user.id}
                currentUserName={viewer.name}
                deckStyleId={custom?.deck_style_id ?? "free"}
                boardStyleId={custom?.board_style_id ?? "green_felt"}
            />
        </div>
    );
}
