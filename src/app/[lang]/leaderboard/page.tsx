import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LeaderboardBoard } from "@/components/leaderboard/LeaderboardBoard";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageShell } from "@/components/ui/PageShell";
import { getAuthUser } from "@/lib/auth/session";
import { getLeaderboard } from "@/lib/models/leaderboard";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({
    params,
}: {
    params: Promise<{ lang: Locale }>;
}): Promise<Metadata> {
    const { lang } = await params;
    const t = await getTranslations({ locale: lang, namespace: "leaderboard" });
    return { title: t("title"), description: t("subtitle") };
}

// Ratings are world-readable (player_elo RLS): guests see the board too.
export default async function Page({
    params,
}: {
    params: Promise<{ lang: Locale }>;
}) {
    const { lang } = await params;
    setRequestLocale(lang);
    const t = await getTranslations("leaderboard");

    const supabase = await createClient();
    const [user, games] = await Promise.all([
        getAuthUser(),
        getLeaderboard(supabase),
    ]);

    return (
        <PageShell>
            <PageHeader title={t("title")} subtitle={t("subtitle")} />
            <LeaderboardBoard games={games} viewerId={user?.id ?? null} />
        </PageShell>
    );
}
