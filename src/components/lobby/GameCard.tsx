import type { ReactNode } from "react";
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
    /** Action area (buttons / link). Rendered only for available games. */
    readonly footer?: ReactNode;
}

/**
 * One game tile, shared by the home showcase and the play hub. Purely
 * presentational (no hooks) so it renders in both server and client trees; the
 * caller supplies already-translated labels and the action footer.
 */
export function GameCard({
    game,
    categoryLabel,
    description,
    meta,
    footer,
}: Props) {
    const { accent, available, suits, difficulty } = game;
    const primarySuit = suits.trim()[0] ?? "♠";

    return (
        <div
            className={`group panel relative flex flex-col overflow-hidden p-5 ${available ? "lift" : ""}`}
            style={{ opacity: available ? 1 : 0.85 }}
        >
            {/* Faint suit watermark for flair — low-opacity ink on cream. */}
            <span
                aria-hidden
                className="font-display pointer-events-none absolute -top-8 -right-3 select-none leading-none"
                style={{
                    fontSize: "10rem",
                    color: "var(--ink)",
                    opacity: available ? 0.06 : 0.04,
                    transform: "rotate(8deg)",
                }}
            >
                {primarySuit}
            </span>

            <div className="relative z-10 flex flex-1 flex-col gap-4">
                <div className="flex items-start justify-between gap-3">
                    {/* Chunky rotated glyph tile holding the game's suits. */}
                    <span
                        className="flex h-12 items-center justify-center rounded-xl px-3 font-display text-xl leading-none"
                        style={{
                            background: available ? accent : "var(--cream2)",
                            color: available ? "var(--ink)" : "#5a5340",
                            border: "2.5px solid var(--ink)",
                            boxShadow: "0 4px 0 var(--ink)",
                            transform: "rotate(-4deg)",
                        }}
                    >
                        {suits}
                    </span>
                    {available ? (
                        <span
                            role="img"
                            className="mt-1 flex items-center gap-1.5"
                            title={meta.difficulty}
                            aria-label={meta.difficulty}
                        >
                            {[1, 2, 3].map((pip) => (
                                <span
                                    key={pip}
                                    className="h-2.5 w-2.5 rounded-xs"
                                    style={{
                                        background:
                                            pip <= difficulty
                                                ? accent
                                                : "var(--cream2)",
                                        border: "2px solid var(--ink)",
                                    }}
                                />
                            ))}
                        </span>
                    ) : (
                        <span
                            className="stamp mt-1"
                            style={{
                                background: "var(--cream2)",
                                color: "#5a5340",
                            }}
                        >
                            {meta.comingSoon}
                        </span>
                    )}
                </div>

                <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                        <h3
                            className="font-display text-2xl leading-tight"
                            style={{
                                color: available ? "var(--ink)" : "#5a5340",
                            }}
                        >
                            {game.name}
                        </h3>
                        <span
                            className="stamp"
                            style={{
                                background: available
                                    ? accent
                                    : "var(--cream2)",
                                color: available ? "var(--ink)" : "#5a5340",
                            }}
                        >
                            {categoryLabel}
                        </span>
                    </div>
                    <p
                        className="text-sm font-semibold leading-snug"
                        style={{ color: "#5a5340" }}
                    >
                        {description}
                    </p>
                </div>

                <div className="mt-auto flex flex-wrap items-center gap-2">
                    <span
                        className="stamp"
                        style={{
                            background: "var(--cream)",
                            color: "var(--ink)",
                        }}
                    >
                        {meta.players}
                    </span>
                    <span
                        className="stamp"
                        style={{
                            background: "var(--cream)",
                            color: "var(--ink)",
                        }}
                    >
                        {meta.duration}
                    </span>
                </div>

                {available && footer ? (
                    <div className="flex flex-col gap-2">{footer}</div>
                ) : null}
            </div>
        </div>
    );
}
