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
        <div className="panel-d p-6">
            <h2
                className="stamp mb-5"
                style={{ background: "var(--gold)", color: "var(--ink)" }}
            >
                {t("ratings_title")}
            </h2>

            {ratings.length === 0 ? (
                <p
                    className="text-sm font-semibold"
                    style={{ color: "var(--muted)" }}
                >
                    {t("ratings_empty")}
                </p>
            ) : (
                <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                    {ratings.map((r) => (
                        <li
                            key={r.moduleId}
                            className="panel flat flex items-center justify-between gap-3 px-4 py-3"
                        >
                            <div className="min-w-0">
                                <p
                                    className="text-sm font-bold truncate"
                                    style={{ color: "var(--ink)" }}
                                >
                                    {r.moduleName}
                                </p>
                                <p
                                    className="text-xs font-semibold"
                                    style={{ color: "#5a5340" }}
                                >
                                    {r.gamesPlayed} {t("ratings_played")} ·{" "}
                                    {r.wins} {t("ratings_wins")}
                                </p>
                            </div>
                            <span
                                className="font-display text-2xl xl:text-3xl shrink-0 tabular-nums"
                                style={{ color: "var(--ink)" }}
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
