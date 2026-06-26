import { getTranslations } from "next-intl/server";
import { NavAvatar } from "@/components/nav/NavAvatar";
import type { LeaderboardGame } from "@/lib/models/leaderboard";
import { publicStorageUrl } from "@/lib/supabase/storage";

/** Medal tint for the podium; everyone below shares the muted rank colour. */
function rankColor(position: number): string {
    if (position === 1) return "#f5c516"; // gold
    if (position === 2) return "#cdd2da"; // silver
    if (position === 3) return "#cd8b4f"; // bronze
    return "#7a6a50";
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
            <div
                className="rounded-xl p-8 border text-center"
                style={{ background: "#1c1510", borderColor: "#3d2d18" }}
            >
                <p
                    className="text-sm font-semibold"
                    style={{ color: "#9a8870" }}
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
                    className="rounded-xl p-5 xl:p-6 border flex flex-col"
                    style={{ background: "#1c1510", borderColor: "#3d2d18" }}
                >
                    <div className="flex items-baseline justify-between mb-4">
                        <h2
                            className="text-lg xl:text-xl font-black tracking-tight"
                            style={{ color: "#faf2e2" }}
                        >
                            {game.moduleName}
                        </h2>
                        <span
                            className="text-[10px] font-bold uppercase tracking-widest"
                            style={{ color: "#7a6a50" }}
                        >
                            {t("rating")}
                        </span>
                    </div>

                    {game.entries.length === 0 ? (
                        <p
                            className="text-sm font-semibold"
                            style={{ color: "#9a8870" }}
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
                                        className="flex items-center gap-3 rounded-lg px-3 py-2.5 border"
                                        style={{
                                            background: isViewer
                                                ? "rgba(245,197,22,0.08)"
                                                : "#231808",
                                            borderColor: isViewer
                                                ? "rgba(245,197,22,0.35)"
                                                : "#3d2d18",
                                        }}
                                    >
                                        <span
                                            className="w-6 text-center text-base font-black tabular-nums shrink-0"
                                            style={{
                                                color: rankColor(position),
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
                                                className="text-sm font-black truncate"
                                                style={{
                                                    color: isViewer
                                                        ? "#f5c516"
                                                        : "#faf2e2",
                                                }}
                                            >
                                                {entry.username}
                                                {isViewer && (
                                                    <span
                                                        className="ml-2 text-[10px] font-bold uppercase tracking-wider"
                                                        style={{
                                                            color: "#f5c516",
                                                        }}
                                                    >
                                                        {t("you")}
                                                    </span>
                                                )}
                                            </p>
                                            <p
                                                className="text-xs font-semibold"
                                                style={{ color: "#7a6a50" }}
                                            >
                                                {entry.gamesPlayed} {t("games")}{" "}
                                                · {entry.wins} {t("wins")}
                                            </p>
                                        </div>

                                        <span
                                            className="text-xl xl:text-2xl font-black shrink-0 tabular-nums"
                                            style={{ color: "#f5c516" }}
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
