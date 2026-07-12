"use client";

import { useTranslations } from "next-intl";
import { GameButton } from "@/components/ui/GameButton";
import { cardLabel, isRedSuit, useTestPlay } from "@/hooks/studio/useTestPlay";
import type { EcaDefinition } from "@/lib/eca/types";
import { TestPlayLog } from "./TestPlayLog";
import { TestPlaySeat } from "./TestPlaySeat";

/**
 * Studio sandbox: the current draft becomes a real GameModule (`eca:draft`)
 * driven through the REAL runner. A thin shell over {@link useTestPlay} — the
 * table center (stock / discard / direction / turn), one {@link TestPlaySeat}
 * per player, and the {@link TestPlayLog}. If it works here, it works in a
 * match.
 */
export function TestPlay({
    definition,
    valid,
}: {
    readonly definition: EcaDefinition;
    readonly valid: boolean;
}) {
    const t = useTranslations("studio");
    const {
        sandbox,
        stale,
        over,
        topDiscard,
        seats,
        winnerNames,
        currentName,
        refusalText,
        start,
        act,
    } = useTestPlay(definition);

    return (
        <section className="panel-d flex flex-col gap-4 p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-3">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <h2 className="font-display text-xl text-wc-cream">
                        {t("test_title")}
                    </h2>
                    <p className="sub text-xs">{t("test_subtitle")}</p>
                </div>
                <GameButton
                    variant="green"
                    size="sm"
                    onClick={start}
                    disabled={!valid}
                >
                    {sandbox ? t("test_restart") : t("test_start")}
                </GameButton>
            </div>

            {!valid && (
                <p
                    className="rounded-xl px-4 py-3 text-sm font-bold"
                    style={{
                        background: "var(--red)",
                        border: "2.5px solid var(--ink)",
                        color: "var(--accent-ink)",
                    }}
                >
                    {t("test_invalid")}
                </p>
            )}

            {sandbox && stale && (
                <p
                    className="rounded-xl px-4 py-3 text-sm font-bold"
                    style={{
                        background: "var(--gold)",
                        border: "2.5px solid var(--ink)",
                        color: "var(--ink)",
                    }}
                >
                    {t("test_stale")}
                </p>
            )}

            {sandbox && (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                    <div className="flex flex-col gap-4 lg:col-span-2">
                        {/* Table center: stock, discard, direction, turn. */}
                        <div className="flex flex-wrap items-center gap-3">
                            <span
                                className="stamp"
                                style={{
                                    background: "var(--cream2)",
                                    color: "var(--ink)",
                                }}
                            >
                                {t("test_draw_pile")}{" "}
                                {sandbox.state.drawPile.length}
                            </span>
                            <span
                                className="stamp"
                                style={{
                                    background: "var(--cream)",
                                    color:
                                        topDiscard && isRedSuit(topDiscard)
                                            ? "var(--red)"
                                            : "var(--ink)",
                                }}
                            >
                                {t("test_discard")}{" "}
                                {topDiscard
                                    ? cardLabel(topDiscard)
                                    : t("test_discard_empty")}
                            </span>
                            <span
                                className="stamp"
                                style={{
                                    background: "var(--purple)",
                                    color: "var(--accent-ink)",
                                }}
                            >
                                {t("test_direction")}{" "}
                                {sandbox.state.direction === 1 ? "→" : "←"}
                            </span>
                            {!over && currentName && (
                                <span
                                    className="stamp"
                                    style={{
                                        background: "var(--gold)",
                                        color: "var(--ink)",
                                    }}
                                >
                                    {t("test_current", { name: currentName })}
                                </span>
                            )}
                        </div>

                        {over && (
                            <p
                                className="rounded-xl px-4 py-3 text-sm font-bold"
                                style={{
                                    background: "var(--green)",
                                    border: "2.5px solid var(--ink)",
                                    boxShadow: "0 4px 0 var(--ink)",
                                    color: "var(--ink)",
                                }}
                            >
                                {t("test_winner", { names: winnerNames })}
                            </p>
                        )}

                        {refusalText !== null && (
                            <p
                                className="text-xs font-bold"
                                style={{ color: "var(--red)" }}
                            >
                                {refusalText}
                            </p>
                        )}

                        {/* One panel per seat, rendered from that seat's view. */}
                        <div className="flex flex-col gap-3">
                            {seats.map((seat) => (
                                <TestPlaySeat
                                    key={seat.player.id}
                                    seat={seat}
                                    over={over}
                                    onAct={act}
                                />
                            ))}
                        </div>
                    </div>

                    <TestPlayLog log={sandbox.log} />
                </div>
            )}
        </section>
    );
}
