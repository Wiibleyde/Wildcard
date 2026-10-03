"use client";

import { useTranslations } from "next-intl";
import type { CSSProperties } from "react";
import { Card } from "@/components/card/Card";
import { Tilt } from "@/components/ui/Tilt";
import { Link } from "@/i18n/navigation";
import type { PlayGame } from "@/lib/games/catalog";
import { gameLabels, type Translate } from "@/lib/games/catalogView";

interface Props {
    readonly games: readonly PlayGame[];
    readonly selectedId: string | null;
    /** Omitted: the fan is a showcase and every card links to the lobby. */
    readonly onSelect?: (id: string) => void;
}

/** Degrees between two neighbouring cards. */
const SPREAD = 10;

/**
 * The game picker: one playing card per game, fanned on an arc. Available
 * games are selectable, coming-soon ones lie face down, and the last card
 * opens the Studio.
 */
export function GameFan({ games, selectedId, onSelect }: Props) {
    const t = useTranslations("lobby");
    // catalogView builds its keys dynamically (`cat_${id}`) and takes a loose translator.
    const tg = useTranslations("games") as unknown as Translate;
    const count = games.length + 1;
    const rot = (i: number) => (i - (count - 1) / 2) * SPREAD;

    return (
        // biome-ignore lint/a11y/useSemanticElements: a fieldset breaks the absolutely positioned arc
        <div className="wc-fan" role="group" aria-label={t("pick_title")}>
            {games.map((g, i) => {
                const { description, meta } = gameLabels(g, tg);
                const slotStyle = {
                    "--rot": `${rot(i)}deg`,
                    zIndex: i,
                } as CSSProperties;
                const face = (
                    <FanCard
                        game={g}
                        delay={-i * 0.8}
                        tip={g.available ? description : meta.comingSoon}
                        ribbon={g.available ? g.name : meta.comingSoon}
                    />
                );
                if (!g.available) {
                    return (
                        <div
                            key={g.id}
                            className="wc-fan-slot brightness-75 saturate-50"
                            style={slotStyle}
                            aria-label={`${g.name} · ${meta.comingSoon}`}
                            role="img"
                        >
                            {face}
                        </div>
                    );
                }
                if (!onSelect) {
                    return (
                        <Link
                            key={g.id}
                            href="/lobby"
                            className="wc-fan-slot"
                            style={slotStyle}
                            aria-label={g.name}
                        >
                            {face}
                        </Link>
                    );
                }
                return (
                    <button
                        key={g.id}
                        type="button"
                        className="wc-fan-slot"
                        style={slotStyle}
                        aria-pressed={g.id === selectedId}
                        aria-label={g.name}
                        onClick={() => onSelect(g.id)}
                    >
                        {face}
                    </button>
                );
            })}
            <Link
                href="/studio"
                className="wc-fan-slot"
                style={
                    {
                        "--rot": `${rot(games.length)}deg`,
                        zIndex: games.length,
                    } as CSSProperties
                }
                aria-label={t("studio_card")}
            >
                <Tip title={t("studio_card")} accent="var(--gold-d)">
                    {t("studio_card_desc")}
                </Tip>
                <Tilt sway swayDelay={-games.length * 0.8} strength={20}>
                    <span
                        aria-hidden="true"
                        className="grid aspect-[5/7] w-full place-items-center rounded-[6%] font-display text-wc-gold"
                        style={{
                            background:
                                "repeating-linear-gradient(45deg, rgba(245,198,79,0.12) 0 3px, transparent 3px 9px), var(--panel-d2)",
                            boxShadow:
                                "inset 0 0 0 2px var(--gold-d), 0 3px 0 rgba(0,0,0,0.35)",
                            fontSize: "calc(var(--gw) * 0.42)",
                        }}
                    >
                        ?
                    </span>
                    <Ribbon accent="var(--gold-d)">{t("studio_card")}</Ribbon>
                </Tilt>
            </Link>
        </div>
    );
}

function FanCard({
    game,
    delay,
    tip,
    ribbon,
}: {
    game: PlayGame;
    delay: number;
    tip: string;
    ribbon: string;
}) {
    return (
        <>
            <Tip title={game.name} accent={game.accent}>
                {tip}
            </Tip>
            <Tilt sway swayDelay={delay} strength={20}>
                <span className="pointer-events-none block">
                    <Card card={game.signature} faceDown={!game.available} />
                </span>
                <Ribbon accent={game.available ? game.accent : "var(--edge)"}>
                    {ribbon}
                </Ribbon>
            </Tilt>
        </>
    );
}

function Ribbon({
    accent,
    children,
}: {
    accent: string;
    children: React.ReactNode;
}) {
    return (
        <span
            className="absolute right-[10%] bottom-[14%] left-[10%] truncate rounded-lg px-1 py-1 text-center font-display text-white text-shadow"
            style={{
                background: accent,
                boxShadow: "0 3px 0 rgba(0,0,0,0.3)",
                fontSize: "calc(var(--gw) * 0.1)",
            }}
        >
            {children}
        </span>
    );
}

function Tip({
    title,
    accent,
    children,
}: {
    title: string;
    accent: string;
    children: React.ReactNode;
}) {
    return (
        <span className="wc-fan-tip panel block p-2.5 text-center">
            <span
                className="mb-2 inline-block rounded-md px-2.5 py-1 font-display text-base text-white text-shadow"
                style={{ background: accent }}
            >
                {title}
            </span>
            <span className="card-surface block px-2.5 py-2 text-[13px] font-medium">
                {children}
            </span>
        </span>
    );
}
