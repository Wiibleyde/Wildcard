import { getTranslations } from "next-intl/server";
import { LeaderboardBoard } from "@/components/leaderboard/LeaderboardBoard";
import { getLeaderboard } from "@/lib/models/leaderboard";
import { createClient } from "@/lib/supabase/server";

/**
 * Public ELO leaderboard. Ratings are world-readable (player_elo RLS), so the
 * page renders for guests too — no auth redirect. The signed-in viewer's rows
 * are highlighted across every game.
 */
export async function LeaderboardPage() {
    const t = await getTranslations("leaderboard");

    const supabase = await createClient();
    const [
        {
            data: { user },
        },
        games,
    ] = await Promise.all([supabase.auth.getUser(), getLeaderboard(supabase)]);

    return (
        <div
            className="min-h-screen px-4 xl:px-10 pt-6 md:pt-10 pb-16"
            style={{ background: "#0d0a05" }}
        >
            <div className="max-w-lg lg:max-w-4xl xl:max-w-6xl 2xl:max-w-7xl mx-auto flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                    <h1
                        className="text-2xl xl:text-3xl font-black tracking-tight"
                        style={{ color: "#faf2e2" }}
                    >
                        {t("title")}
                    </h1>
                    <p
                        className="text-sm font-semibold"
                        style={{ color: "#9a8870" }}
                    >
                        {t("subtitle")}
                    </p>
                </div>

                <LeaderboardBoard games={games} viewerId={user?.id ?? null} />
            </div>
        </div>
    );
}
