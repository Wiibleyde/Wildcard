import { useTranslations } from "next-intl";
import { Card } from "@/components/card/Card";
import { buildPlayCatalog } from "@/lib/games/catalog";

export interface EloRatingRow {
    readonly moduleId: string;
    readonly moduleName: string;
    readonly rating: number;
    readonly gamesPlayed: number;
    readonly wins: number;
}

/** One tile per rated game, headed by the game's signature card. */
export function ProfileEloCard({
    ratings,
}: {
    ratings: readonly EloRatingRow[];
}) {
    const t = useTranslations("profile");
    const tCommon = useTranslations("common");
    const signatureOf = new Map(
        buildPlayCatalog().map((g) => [g.id, g.signature]),
    );

    return (
        <section className="panel flex flex-col gap-4 p-5">
            <h2 className="h-lg">{t("ratings_title")}</h2>

            {ratings.length === 0 ? (
                <p className="well px-4 py-6 text-center text-sm font-semibold text-wc-muted">
                    {t("ratings_empty")}
                </p>
            ) : (
                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {ratings.map((r) => {
                        const signature = signatureOf.get(r.moduleId);
                        return (
                            <li
                                key={r.moduleId}
                                className="well flex items-center gap-3 p-3"
                            >
                                <div className="w-11 shrink-0">
                                    {signature ? (
                                        <Card card={signature} />
                                    ) : (
                                        <span
                                            aria-hidden="true"
                                            className="card-surface grid aspect-[5/7] place-items-center font-display text-xl text-wc-red"
                                        >
                                            ♦
                                        </span>
                                    )}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate font-extrabold">
                                        {r.moduleName}
                                    </p>
                                    <p className="text-xs font-semibold text-wc-muted">
                                        {tCommon("games_wins", {
                                            games: r.gamesPlayed,
                                            wins: r.wins,
                                        })}
                                    </p>
                                </div>
                                <span className="shrink-0 rounded-lg bg-wc-blue px-2.5 py-1 font-display text-xl text-white tabular-nums text-shadow shadow-[inset_0_-3px_0_rgba(0,0,0,0.25)]">
                                    {r.rating}
                                </span>
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
}
