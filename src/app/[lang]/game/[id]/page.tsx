import { notFound, redirect } from "next/navigation";
import type { Locale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { GamePlayClient } from "@/components/game/GamePlayClient";
import { getGameClientState } from "@/lib/models/game";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export default async function Page({
    params,
}: {
    params: Promise<{ lang: Locale; id: string }>;
}) {
    const { lang, id } = await params;
    setRequestLocale(lang);

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect(`/${lang}/login`);

    // Service-role read: the secret state never leaves the server; the client
    // receives only the redacted `view()` projection in `result.payload`.
    const admin = createAdminClient();
    const result = await getGameClientState(admin, id, user.id);
    if (!result.ok) notFound();

    const { data: custom } = await supabase
        .from("player_customizations")
        .select("deck_style_id, board_style_id")
        .eq("user_id", user.id)
        .maybeSingle();

    return (
        <div
            className="min-h-screen px-4 xl:px-10 pt-6 pb-16"
            style={{ background: "#0d0a05" }}
        >
            <GamePlayClient
                initial={result.payload}
                currentUserId={user.id}
                deckStyleId={custom?.deck_style_id ?? "free"}
                boardStyleId={custom?.board_style_id ?? "green_felt"}
            />
        </div>
    );
}
