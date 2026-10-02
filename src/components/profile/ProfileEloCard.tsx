import { useTranslations } from "next-intl";

export interface EloRatingRow {
    readonly moduleId: string;
    readonly moduleName: string;
    readonly rating: number;
    readonly gamesPlayed: number;
    readonly wins: number;
}

export function ProfileEloCard({
    ratings,
}: {
    ratings: readonly EloRatingRow[];
}) {
    const t = useTranslations("profile");
    const tCommon = useTranslations("common");

    return (
        <div className="panel-d p-6">
            <h2
                className="stamp mb-5"
                style={{ background: "var(--gold)", color: "var(--ink)" }}
            >
                {t("ratings_title")}
            </h2>

            {ratings.length === 0 ? (
                <p className="text-sm font-semibold text-wc-muted">
                    {t("ratings_empty")}
                </p>
            ) : (
                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {ratings.map((r) => (
                        <li
                            key={r.moduleId}
                            className="panel flat flex items-center justify-between gap-3 px-4 py-3"
                        >
                            <div className="min-w-0">
                                <p className="truncate text-sm font-bold text-wc-ink">
                                    {r.moduleName}
                                </p>
                                <p className="text-xs font-semibold text-wc-ink-soft">
                                    {tCommon("games_wins", {
                                        games: r.gamesPlayed,
                                        wins: r.wins,
                                    })}
                                </p>
                            </div>
                            <span className="shrink-0 font-display text-2xl text-wc-ink tabular-nums xl:text-3xl">
                                {r.rating}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
