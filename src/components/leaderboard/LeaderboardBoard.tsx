import { useTranslations } from "next-intl";
import { Avatar } from "@/components/ui/Avatar";
import { nameTag, portalAvatarUrl } from "@/lib/models/identities";
import type { LeaderboardGame } from "@/lib/models/leaderboard";

function rankColor(position: number): string {
    if (position === 1) return "var(--gold)";
    if (position === 2) return "var(--silver)";
    if (position === 3) return "var(--bronze)";
    return "var(--panel-d)";
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
                <p className="text-sm font-semibold text-wc-muted">
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
                        <h2 className="h-lg">{game.moduleName}</h2>
                        <span className="stamp bg-wc-blue text-white">
                            {t("rating")}
                        </span>
                    </div>

                    {game.entries.length === 0 ? (
                        <p className="text-sm font-semibold text-wc-muted">
                            {t("empty")}
                        </p>
                    ) : (
                        <ol className="flex flex-col gap-1.5">
                            {game.entries.map((entry, index) => {
                                const position = index + 1;
                                const isViewer = entry.userId === viewerId;
                                const name =
                                    entry.username ??
                                    tCommon("player_fallback", {
                                        tag: nameTag(entry.userId),
                                    });
                                return (
                                    <li
                                        key={entry.userId}
                                        className={`well flex items-center gap-3 px-3 py-2.5 ${
                                            isViewer
                                                ? "shadow-[inset_0_0_0_2px_var(--gold)]"
                                                : ""
                                        }`}
                                    >
                                        <span
                                            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg font-display text-base tabular-nums shadow-[inset_0_-3px_0_rgba(0,0,0,0.25)]"
                                            style={{
                                                background: rankColor(position),
                                                color:
                                                    position <= 3
                                                        ? "var(--ink)"
                                                        : "var(--muted)",
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
                                            <p className="flex items-center gap-2 truncate text-sm font-extrabold">
                                                <span className="truncate">
                                                    {name}
                                                </span>
                                                {isViewer && (
                                                    <span className="stamp shrink-0 bg-wc-gold text-wc-ink">
                                                        {t("you")}
                                                    </span>
                                                )}
                                            </p>
                                            <p className="text-xs font-semibold text-wc-muted">
                                                {tCommon("games_wins", {
                                                    games: entry.gamesPlayed,
                                                    wins: entry.wins,
                                                })}
                                            </p>
                                        </div>

                                        <span className="shrink-0 font-display text-xl tabular-nums text-shadow xl:text-2xl">
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
