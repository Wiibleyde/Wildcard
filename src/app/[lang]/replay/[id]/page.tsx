import { notFound, redirect } from "next/navigation";
import type { Locale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { ReplayClient } from "@/components/game/ReplayClient";
import { getReplay } from "@/lib/models/replay";
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

    // Service-role re-derivation: secret state stays server-side; client gets only per-frame redacted views.
    const admin = createAdminClient();
    const result = await getReplay(admin, id, user.id);
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
            <ReplayClient
                payload={result.payload}
                currentUserId={user.id}
                deckStyleId={custom?.deck_style_id ?? "free"}
                boardStyleId={custom?.board_style_id ?? "green_felt"}
            />
        </div>
    );
}
