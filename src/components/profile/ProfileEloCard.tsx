import { getTranslations } from "next-intl/server";

export interface EloRatingRow {
    readonly moduleId: string;
    readonly moduleName: string;
    readonly rating: number;
    readonly gamesPlayed: number;
    readonly wins: number;
}

/**
 * Per-game ELO standings on the profile. Ratings are derived server-side from
 * each finished game's outcome (see src/lib/models/elo) — the client only reads
 * them. One row per game the player has been rated on, best rating first.
 */
export async function ProfileEloCard({
    ratings,
}: {
    ratings: readonly EloRatingRow[];
}) {
    const t = await getTranslations("profile");

    return (
        <div
            className="rounded-xl p-6 border"
            style={{ background: "#1c1510", borderColor: "#3d2d18" }}
        >
            <h2
                className="text-xs font-bold uppercase tracking-widest mb-5"
                style={{ color: "#7a6a50" }}
            >
                {t("ratings_title")}
            </h2>

            {ratings.length === 0 ? (
                <p
                    className="text-sm font-semibold"
                    style={{ color: "#9a8870" }}
                >
                    {t("ratings_empty")}
                </p>
            ) : (
                <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                    {ratings.map((r) => (
                        <li
                            key={r.moduleId}
                            className="flex items-center justify-between gap-3 rounded-lg px-4 py-3 border"
                            style={{
                                background: "#231808",
                                borderColor: "#3d2d18",
                            }}
                        >
                            <div className="min-w-0">
                                <p
                                    className="text-sm font-black truncate"
                                    style={{ color: "#faf2e2" }}
                                >
                                    {r.moduleName}
                                </p>
                                <p
                                    className="text-xs font-semibold"
                                    style={{ color: "#7a6a50" }}
                                >
                                    {r.gamesPlayed} {t("ratings_played")} ·{" "}
                                    {r.wins} {t("ratings_wins")}
                                </p>
                            </div>
                            <span
                                className="text-2xl xl:text-3xl font-black shrink-0 tabular-nums"
                                style={{ color: "#f5c516" }}
                            >
                                {r.rating}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
