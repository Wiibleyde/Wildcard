import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { EloRatingRow } from "@/components/profile/ProfileEloCard";
import { ProfileView } from "@/components/profile/ProfileView";
import { requireAuthUser } from "@/lib/auth/session";
import { accountUrl, forgotPasswordUrl } from "@/lib/auth/urls";
import { getGameModule } from "@/lib/games";
import { ecaNamesByModuleIds } from "@/lib/games/resolve";
import { identityOf, nameTag, portalAvatarUrl } from "@/lib/models/identities";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({
    params,
}: {
    params: Promise<{ lang: Locale }>;
}): Promise<Metadata> {
    const { lang } = await params;
    const t = await getTranslations({ locale: lang, namespace: "profile" });
    return { title: t("title") };
}

export default async function Page({
    params,
}: {
    params: Promise<{ lang: Locale }>;
}) {
    const { lang } = await params;
    setRequestLocale(lang);

    const user = await requireAuthUser(lang, `/${lang}/profile`);
    const supabase = await createClient();

    const [identity, profileRes, xpRes, eloRes] = await Promise.all([
        identityOf(supabase, user.id),
        supabase
            .from("profiles")
            .select("created_at")
            .eq("id", user.id)
            .single(),
        supabase.from("player_xp").select("xp").eq("user_id", user.id).single(),
        supabase
            .from("player_elo")
            .select("module_id, rating, games_played, wins")
            .eq("user_id", user.id)
            .order("rating", { ascending: false }),
    ]);

    const eloRows = eloRes.data ?? [];
    const ecaNames = await ecaNamesByModuleIds(
        supabase,
        eloRows.map((row) => row.module_id),
    );
    const ratings: EloRatingRow[] = eloRows.map((row) => ({
        moduleId: row.module_id,
        moduleName:
            getGameModule(row.module_id)?.name ??
            ecaNames.get(row.module_id) ??
            row.module_id,
        rating: row.rating,
        gamesPlayed: row.games_played,
        wins: row.wins,
    }));

    const createdAt = profileRes.data?.created_at;
    const tCommon = await getTranslations("common");

    return (
        <ProfileView
            name={
                identity.name ??
                tCommon("player_fallback", { tag: nameTag(user.id) })
            }
            avatarUrl={portalAvatarUrl(identity.avatarPath)}
            xp={xpRes.data?.xp ?? 0}
            memberSince={createdAt ? new Date(createdAt) : null}
            ratings={ratings}
            manageUrl={accountUrl()}
            forgotUrl={forgotPasswordUrl()}
        />
    );
}
