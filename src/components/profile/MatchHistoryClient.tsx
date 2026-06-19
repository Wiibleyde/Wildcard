"use client";

import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Link } from "@/i18n/navigation";
import type { MatchHistoryEntry, MatchResult } from "@/lib/models/history";
import { MAX_PERSISTENT_REPLAYS } from "@/lib/models/persistence";

interface Props {
    entries: readonly MatchHistoryEntry[];
}

const RESULT_STYLE: Record<
    MatchResult,
    { bg: string; border: string; fg: string }
> = {
    win: {
        bg: "rgba(72,201,122,0.12)",
        border: "rgba(72,201,122,0.4)",
        fg: "#48c97a",
    },
    loss: {
        bg: "rgba(224,64,64,0.12)",
        border: "rgba(224,64,64,0.4)",
        fg: "#e04040",
    },
    none: { bg: "rgba(255,255,255,0.04)", border: "#3d2d18", fg: "#9a8870" },
};

export function MatchHistoryClient({ entries }: Props) {
    const t = useTranslations("history");
    const locale = useLocale();
    const [game, setGame] = useState("all");
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");

    // Pinned games survive the 15-day move-retention sweep. Seeded from the
    // server, then kept in sync as the viewer toggles pins (optimistic, rolled
    // back on failure). Capped at MAX_PERSISTENT_REPLAYS per account.
    const [pinned, setPinned] = useState<Set<string>>(
        () => new Set(entries.filter((e) => e.persistent).map((e) => e.gameId)),
    );
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const isPinned = (id: string) => pinned.has(id);

    async function togglePin(gameId: string) {
        if (busy) return;
        const next = !pinned.has(gameId);
        if (next && pinned.size >= MAX_PERSISTENT_REPLAYS) {
            setError(t("cap_reached", { max: MAX_PERSISTENT_REPLAYS }));
            return;
        }
        setBusy(gameId);
        setError(null);
        // Optimistic flip.
        setPinned((prev) => {
            const copy = new Set(prev);
            if (next) copy.add(gameId);
            else copy.delete(gameId);
            return copy;
        });
        try {
            const res = await fetch(`/api/games/${gameId}/persist`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ persistent: next }),
            });
            if (!res.ok) {
                const body = (await res.json().catch(() => ({}))) as {
                    error?: string;
                };
                throw new Error(body.error ?? "pin_error");
            }
        } catch (e) {
            // Roll back the optimistic flip and surface a message.
            setPinned((prev) => {
                const copy = new Set(prev);
                if (next) copy.delete(gameId);
                else copy.add(gameId);
                return copy;
            });
            const code = e instanceof Error ? e.message : "pin_error";
            setError(
                code === "cap_reached"
                    ? t("cap_reached", { max: MAX_PERSISTENT_REPLAYS })
                    : t("pin_error"),
            );
        } finally {
            setBusy(null);
        }
    }

    // Filter options = only the games the player has actually played.
    const games = useMemo(() => {
        const seen = new Map<string, string>();
        for (const e of entries) seen.set(e.moduleId, e.moduleName);
        return [...seen].map(([id, name]) => ({ id, name }));
    }, [entries]);

    const filtered = useMemo(() => {
        const fromMs = from ? new Date(from).getTime() : null;
        // `to` is a day → include the whole day by pushing to its end.
        const toMs = to ? new Date(to).getTime() + 86_400_000 : null;
        return entries.filter((e) => {
            if (game !== "all" && e.moduleId !== game) return false;
            const at = new Date(e.playedAt).getTime();
            if (fromMs !== null && at < fromMs) return false;
            if (toMs !== null && at >= toMs) return false;
            return true;
        });
    }, [entries, game, from, to]);

    const hasFilters = game !== "all" || from !== "" || to !== "";

    function reset() {
        setGame("all");
        setFrom("");
        setTo("");
    }

    function formatDate(iso: string) {
        return new Date(iso).toLocaleDateString(
            locale === "fr" ? "fr-FR" : "en-US",
            { day: "numeric", month: "short", year: "numeric" },
        );
    }

    const fieldStyle = {
        background: "rgba(0,0,0,0.3)",
        border: "2px solid #3d2d18",
        color: "#faf2e2",
    } as const;

    return (
        <div className="flex flex-col gap-5">
            {/* ── Filters ─────────────────────────────────────────────── */}
            <div
                className="rounded-xl p-4 xl:p-5 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end"
                style={{ background: "#1c1510", border: "2px solid #3d2d18" }}
            >
                <label className="flex flex-col gap-1.5 flex-1 min-w-35">
                    <span
                        className="text-xs font-bold uppercase tracking-widest"
                        style={{ color: "#7a6a50" }}
                    >
                        {t("filter_game")}
                    </span>
                    <select
                        value={game}
                        onChange={(e) => setGame(e.target.value)}
                        className="rounded-lg px-3 py-2.5 font-semibold text-sm outline-none"
                        style={fieldStyle}
                    >
                        <option value="all">{t("all_games")}</option>
                        {games.map((g) => (
                            <option key={g.id} value={g.id}>
                                {g.name}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="flex flex-col gap-1.5 flex-1 min-w-35">
                    <span
                        className="text-xs font-bold uppercase tracking-widest"
                        style={{ color: "#7a6a50" }}
                    >
                        {t("filter_from")}
                    </span>
                    <input
                        type="date"
                        value={from}
                        max={to || undefined}
                        onChange={(e) => setFrom(e.target.value)}
                        className="rounded-lg px-3 py-2.5 font-semibold text-sm outline-none"
                        style={fieldStyle}
                    />
                </label>

                <label className="flex flex-col gap-1.5 flex-1 min-w-35">
                    <span
                        className="text-xs font-bold uppercase tracking-widest"
                        style={{ color: "#7a6a50" }}
                    >
                        {t("filter_to")}
                    </span>
                    <input
                        type="date"
                        value={to}
                        min={from || undefined}
                        onChange={(e) => setTo(e.target.value)}
                        className="rounded-lg px-3 py-2.5 font-semibold text-sm outline-none"
                        style={fieldStyle}
                    />
                </label>

                {hasFilters && (
                    <button
                        type="button"
                        onClick={reset}
                        className="rounded-lg px-4 py-2.5 font-bold text-sm transition-transform active:scale-95"
                        style={{
                            background: "rgba(255,255,255,0.04)",
                            border: "2px solid #3d2d18",
                            color: "#9a8870",
                        }}
                    >
                        {t("reset_filters")}
                    </button>
                )}
            </div>

            {/* ── Pin counter + error ─────────────────────────────────── */}
            <div className="flex items-center justify-between gap-3 px-1">
                <span
                    className="text-xs font-bold uppercase tracking-widest"
                    style={{ color: "#7a6a50" }}
                >
                    📌{" "}
                    {t("pin_count", {
                        n: pinned.size,
                        max: MAX_PERSISTENT_REPLAYS,
                    })}
                </span>
                {error && (
                    <span
                        className="text-xs font-semibold"
                        style={{ color: "#e04040" }}
                    >
                        {error}
                    </span>
                )}
            </div>

            {/* ── List ────────────────────────────────────────────────── */}
            {filtered.length === 0 ? (
                <p
                    className="text-sm font-semibold rounded-xl px-4 py-10 text-center"
                    style={{
                        color: "#7a6a50",
                        background: "#1c1510",
                        border: "2px dashed #3d2d18",
                    }}
                >
                    {hasFilters ? t("empty_filtered") : t("empty")}
                </p>
            ) : (
                <ul className="flex flex-col gap-3">
                    {filtered.map((entry) => {
                        const rs = RESULT_STYLE[entry.result];
                        const opponents = entry.players.filter((p) => !p.isYou);
                        return (
                            <li
                                key={entry.gameId}
                                className="rounded-xl p-4 xl:p-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                                style={{
                                    background: "#1c1510",
                                    border: "2px solid #3d2d18",
                                }}
                            >
                                <div className="flex items-center gap-4 min-w-0">
                                    <span
                                        className="inline-flex shrink-0 items-center px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider"
                                        style={{
                                            background: rs.bg,
                                            border: `2px solid ${rs.border}`,
                                            color: rs.fg,
                                        }}
                                    >
                                        {t(`result_${entry.result}`)}
                                    </span>
                                    <div className="min-w-0">
                                        <div
                                            className="font-black truncate"
                                            style={{ color: "#faf2e2" }}
                                        >
                                            {entry.moduleName}
                                        </div>
                                        <div
                                            className="text-xs font-semibold mt-0.5 truncate"
                                            style={{ color: "#9a8870" }}
                                        >
                                            {formatDate(entry.playedAt)}
                                            {opponents.length > 0 && (
                                                <>
                                                    {" · "}
                                                    {t("vs")}{" "}
                                                    {opponents
                                                        .map((p) =>
                                                            p.isBot
                                                                ? `${p.name} (${t("bot")})`
                                                                : p.name,
                                                        )
                                                        .join(", ")}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex shrink-0 items-center gap-2 self-start sm:self-auto">
                                    {/* Pin: keep this replay past the 15-day
                                        sweep. Hidden once the moves are gone —
                                        nothing left to preserve. */}
                                    {!entry.expired && (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                togglePin(entry.gameId)
                                            }
                                            disabled={busy === entry.gameId}
                                            title={
                                                isPinned(entry.gameId)
                                                    ? t("unpin")
                                                    : t("pin_hint")
                                            }
                                            aria-pressed={isPinned(
                                                entry.gameId,
                                            )}
                                            className="rounded-lg px-3 py-2 font-black text-sm transition-transform active:scale-95 disabled:opacity-50"
                                            style={
                                                isPinned(entry.gameId)
                                                    ? {
                                                          background:
                                                              "rgba(245,197,22,0.16)",
                                                          border: "2px solid rgba(245,197,22,0.5)",
                                                          color: "#f5c516",
                                                      }
                                                    : {
                                                          background:
                                                              "rgba(255,255,255,0.04)",
                                                          border: "2px solid #3d2d18",
                                                          color: "#9a8870",
                                                      }
                                            }
                                        >
                                            {isPinned(entry.gameId)
                                                ? `📌 ${t("pinned")}`
                                                : `📌 ${t("pin")}`}
                                        </button>
                                    )}

                                    {entry.expired ? (
                                        <span
                                            aria-disabled="true"
                                            title={t("replay_expired_hint")}
                                            className="rounded-lg px-4 py-2 font-black text-sm text-center cursor-not-allowed opacity-50"
                                            style={{
                                                background:
                                                    "rgba(255,255,255,0.04)",
                                                border: "2px solid #3d2d18",
                                                color: "#7a6a50",
                                            }}
                                        >
                                            {t("replay_expired")}
                                        </span>
                                    ) : (
                                        <Link
                                            href={`/replay/${entry.gameId}`}
                                            className="rounded-lg px-4 py-2 font-black text-sm text-center transition-transform active:scale-95"
                                            style={{
                                                background:
                                                    "rgba(245,197,22,0.12)",
                                                border: "2px solid rgba(245,197,22,0.3)",
                                                color: "#f5c516",
                                            }}
                                        >
                                            {t("replay")}
                                        </Link>
                                    )}
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
