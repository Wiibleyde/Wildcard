import { useTranslations } from "next-intl";
import { Avatar } from "@/components/ui/Avatar";
import { portalAvatarUrl } from "@/lib/models/identities";
import type { LeaderboardGame } from "@/lib/models/leaderboard";

function rankColor(position: number): string {
    if (position === 1) return "var(--gold)";
    if (position === 2) return "var(--silver)";
    if (position === 3) return "var(--bronze)";
    return "var(--cream2)";
}

export function LeaderboardBoard({
    games,
    viewerId,
}: {
    games: readonly LeaderboardGame[];
    viewerId: string | null;
}) {
    const t = useTranslations("leaderboard");
    const tCommon = useTranslations("common");

    if (games.length === 0) {
        return (
            <div className="panel p-8 text-center">
                <p className="text-sm font-semibold text-wc-ink-soft">
                    {t("empty_all")}
                </p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2 2xl:grid-cols-3">
            {games.map((game) => (
                <section
                    key={game.moduleId}
                    className="panel flex flex-col p-5 xl:p-6"
                >
                    <div className="mb-4 flex items-baseline justify-between">
                        <h2 className="font-display text-lg text-wc-ink xl:text-xl">
                            {game.moduleName}
                        </h2>
                        <span
                            className="stamp"
                            style={{
                                background: "var(--cream2)",
                                color: "var(--ink)",
                            }}
                        >
                            {t("rating")}
                        </span>
                    </div>

                    {game.entries.length === 0 ? (
                        <p className="text-sm font-semibold text-wc-ink-soft">
                            {t("empty")}
                        </p>
                    ) : (
                        <ol className="flex flex-col gap-1.5">
                            {game.entries.map((entry, index) => {
                                const position = index + 1;
                                const isViewer = entry.userId === viewerId;
                                return (
                                    <li
                                        key={entry.userId}
                                        className="flex items-center gap-3 rounded-lg border-nb border-wc-ink px-3 py-2.5"
                                        style={{
                                            background: isViewer
                                                ? "var(--gold)"
                                                : "var(--cream2)",
                                        }}
                                    >
                                        <span
                                            className="grid h-7 w-7 shrink-0 place-items-center rounded-md border-nb border-wc-ink font-display text-sm text-wc-ink tabular-nums"
                                            style={{
                                                background: rankColor(position),
                                            }}
                                        >
                                            {position}
                                        </span>

                                        <Avatar
                                            name={entry.username}
                                            avatarUrl={portalAvatarUrl(
                                                entry.avatarPath,
                                            )}
                                            size={36}
                                        />

                                        <div className="min-w-0 flex-1">
                                            <p className="flex items-center gap-2 truncate text-sm font-bold text-wc-ink">
                                                <span className="truncate">
                                                    {entry.username}
                                                </span>
                                                {isViewer && (
                                                    <span
                                                        className="stamp shrink-0"
                                                        style={{
                                                            background:
                                                                "var(--ink)",
                                                            color: "var(--gold)",
                                                        }}
                                                    >
                                                        {t("you")}
                                                    </span>
                                                )}
                                            </p>
                                            <p className="text-xs font-semibold text-wc-ink-soft">
                                                {tCommon("games_wins", {
                                                    games: entry.gamesPlayed,
                                                    wins: entry.wins,
                                                })}
                                            </p>
                                        </div>

                                        <span className="shrink-0 font-display text-xl text-wc-ink tabular-nums xl:text-2xl">
                                            {entry.rating}
                                        </span>
                                    </li>
                                );
                            })}
                        </ol>
                    )}
                </section>
            ))}
        </div>
    );
}
