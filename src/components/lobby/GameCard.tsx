import type { ReactNode } from "react";
import { Card } from "@/components/card/Card";
import type { PlayGame } from "@/lib/games/catalog";

interface MetaLabels {
    readonly players: string;
    readonly duration: string;
    readonly difficulty: string;
    readonly comingSoon: string;
}

interface Props {
    readonly game: PlayGame;
    readonly categoryLabel: string;
    readonly description: string;
    readonly meta: MetaLabels;
    /** Rendered only for available games. */
    readonly footer?: ReactNode;
}

/** Catalog tile: the game's signature card beside its pitch. */
export function GameCard({
    game,
    categoryLabel,
    description,
    meta,
    footer,
}: Props) {
    const { accent, available } = game;

    return (
        <article
            className={`panel flex gap-4 p-4 ${available ? "lift" : "opacity-70"}`}
        >
            <div className="w-16 shrink-0 -rotate-3 xl:w-20">
                <Card card={game.signature} faceDown={!available} />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-xl leading-tight text-shadow">
                        {game.name}
                    </h3>
                    <span
                        className="stamp text-white"
                        style={{
                            background: available ? accent : "var(--edge)",
                        }}
                    >
                        {available ? categoryLabel : meta.comingSoon}
                    </span>
                </div>
                <p className="text-sm leading-snug text-wc-muted">
                    {description}
                </p>
                <p className="text-xs font-bold text-wc-sub">
                    {meta.players} · {meta.duration}
                </p>
                {available && footer ? (
                    <div className="mt-auto pt-1">{footer}</div>
                ) : null}
            </div>
        </article>
    );
}
