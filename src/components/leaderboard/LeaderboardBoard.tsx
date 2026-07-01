import { getTranslations } from "next-intl/server";
import { NavAvatar } from "@/components/nav/NavAvatar";
import type { LeaderboardGame } from "@/lib/models/leaderboard";
import { publicStorageUrl } from "@/lib/supabase/storage";

/** Medal tint for the podium; everyone below shares a muted cream badge. */
function rankColor(position: number): string {
    if (position === 1) return "var(--gold)";
    if (position === 2) return "#cdd2da"; // silver
    if (position === 3) return "#cd8b4f"; // bronze
    return "var(--cream2)";
}

/**
 * Ranked ELO standings, one panel per game. Read-only server projection — the
 * data comes from {@link getLeaderboard}. The viewer's own row is highlighted so
 * they can spot their standing at a glance.
 */
export async function LeaderboardBoard({
    games,
    viewerId,
}: {
    games: readonly LeaderboardGame[];
    viewerId: string | null;
}) {
    const t = await getTranslations("leaderboard");

    if (games.length === 0) {
        return (
            <div className="panel p-8 text-center">
                <p
                    className="text-sm font-semibold"
                    style={{ color: "#5a5340" }}
                >
                    {t("empty_all")}
                </p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-5">
            {games.map((game) => (
                <section
                    key={game.moduleId}
                    className="panel p-5 xl:p-6 flex flex-col"
                >
                    <div className="flex items-baseline justify-between mb-4">
                        <h2
                            className="font-display text-lg xl:text-xl"
                            style={{ color: "var(--ink)" }}
                        >
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
                        <p
                            className="text-sm font-semibold"
                            style={{ color: "#5a5340" }}
                        >
                            {t("empty")}
                        </p>
                    ) : (
                        <ol className="flex flex-col gap-1.5">
                            {game.entries.map((entry, index) => {
                                const position = index + 1;
                                const isViewer = entry.userId === viewerId;
                                const avatarUrl = entry.avatarPath
                                    ? publicStorageUrl(
                                          "avatars",
                                          entry.avatarPath,
                                      )
                                    : null;
                                const initial =
                                    entry.username?.[0]?.toUpperCase() ?? "?";

                                return (
                                    <li
                                        key={entry.userId}
                                        className="flex items-center gap-3 rounded-lg px-3 py-2.5"
                                        style={{
                                            background: isViewer
                                                ? "var(--gold)"
                                                : "var(--cream2)",
                                            border: "2.5px solid var(--ink)",
                                        }}
                                    >
                                        <span
                                            className="grid place-items-center w-7 h-7 shrink-0 rounded-md font-display text-sm tabular-nums"
                                            style={{
                                                background: rankColor(position),
                                                color: "var(--ink)",
                                                border: "2.5px solid var(--ink)",
                                            }}
                                        >
                                            {position}
                                        </span>

                                        <NavAvatar
                                            avatarUrl={avatarUrl}
                                            initial={initial}
                                            username={entry.username}
                                            sizePx={36}
                                            initialClassName="text-sm"
                                        />

                                        <div className="min-w-0 flex-1">
                                            <p
                                                className="text-sm font-bold truncate flex items-center gap-2"
                                                style={{ color: "var(--ink)" }}
                                            >
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
                                            <p
                                                className="text-xs font-semibold"
                                                style={{ color: "#5a5340" }}
                                            >
                                                {entry.gamesPlayed} {t("games")}{" "}
                                                · {entry.wins} {t("wins")}
                                            </p>
                                        </div>

                                        <span
                                            className="font-display text-xl xl:text-2xl shrink-0 tabular-nums"
                                            style={{ color: "var(--ink)" }}
                                        >
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
