"use client";

import { useTranslations } from "next-intl";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { GameButton } from "@/components/ui/GameButton";
import { useTestPlay } from "@/hooks/studio/useTestPlay";
import { ecaCardLabel as cardLabel, isRedSuit } from "@/lib/eca/display";
import type { EcaDefinition } from "@/lib/eca/types";
import { TestPlayLog } from "./TestPlayLog";
import { TestPlaySeat } from "./TestPlaySeat";

/** `definition` is `null` while the draft does not validate. */
export function TestPlay({
    definition,
}: {
    readonly definition: EcaDefinition | null;
}) {
    const t = useTranslations("studio");
    const valid = definition !== null;
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

            {!valid && <ErrorBanner>{t("test_invalid")}</ErrorBanner>}

            {sandbox && stale && (
                <p className="rounded-xl bg-wc-gold px-4 py-3 text-sm font-bold text-wc-ink shadow-[0_4px_0_var(--gold-d)]">
                    {t("test_stale")}
                </p>
            )}

            {sandbox && (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                    <div className="flex flex-col gap-4 lg:col-span-2">
                        <div className="flex flex-wrap items-center gap-3">
                            <span
                                className="stamp"
                                style={{
                                    background: "var(--panel-d2)",
                                    color: "var(--muted)",
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
                                    color: "#fff",
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
                            <p className="rounded-xl bg-wc-green px-4 py-3 text-sm font-bold text-white text-shadow shadow-[0_4px_0_var(--green-d)]">
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
