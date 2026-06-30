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
            className="group relative flex flex-col overflow-hidden rounded-2xl transition-transform duration-150 hover:-translate-y-1"
            style={{
                background: "#1c1510",
                border: `2px solid ${available ? `${accent}44` : "#3d2d18"}`,
                boxShadow: available ? `0 0 24px ${accent}14` : undefined,
                opacity: available ? 1 : 0.72,
            }}
        >
            {/* Faint suit watermark for flair. */}
            <span
                aria-hidden
                className="pointer-events-none absolute -right-4 -top-6 select-none font-black leading-none"
                style={{
                    fontSize: "9rem",
                    color: available ? accent : "#4a3820",
                    opacity: available ? 0.07 : 0.05,
                    transform: "rotate(8deg)",
                }}
            >
                {primarySuit}
            </span>

            <div className="relative z-10 flex flex-1 flex-col gap-4 p-5">
                <div className="flex items-start justify-between gap-2">
                    <span
                        className="text-2xl font-black leading-none tracking-tight"
                        style={{ color: available ? accent : "#4a3820" }}
                    >
                        {suits}
                    </span>
                    {available ? (
                        <span
                            role="img"
                            className="flex items-center gap-1"
                            title={meta.difficulty}
                            aria-label={meta.difficulty}
                        >
                            {[1, 2, 3].map((pip) => (
                                <span
                                    key={pip}
                                    className="h-1.5 w-1.5 rounded-full"
                                    style={{
                                        background:
                                            pip <= difficulty
                                                ? accent
                                                : "#3d2d18",
                                    }}
                                />
                            ))}
                        </span>
                    ) : (
                        <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                            style={{
                                background: "rgba(255,255,255,0.04)",
                                color: "#7a6a50",
                                border: "1px solid #3d2d18",
                            }}
                        >
                            {meta.comingSoon}
                        </span>
                    )}
                </div>

                <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                        <h3
                            className="text-xl font-black leading-tight"
                            style={{ color: available ? "#faf2e2" : "#6a5a40" }}
                        >
                            {game.name}
                        </h3>
                        <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                            style={{
                                background: available
                                    ? `${accent}18`
                                    : "rgba(255,255,255,0.03)",
                                color: available ? accent : "#7a6a50",
                            }}
                        >
                            {categoryLabel}
                        </span>
                    </div>
                    <p
                        className="text-sm font-semibold leading-snug"
                        style={{ color: "#9a8870" }}
                    >
                        {description}
                    </p>
                </div>

                <div
                    className="mt-auto flex items-center gap-3 text-xs font-bold"
                    style={{ color: "#7a6a50" }}
                >
                    <span>{meta.players}</span>
                    <span style={{ color: "#3d2d18" }}>•</span>
                    <span>{meta.duration}</span>
                </div>

                {available && footer ? (
                    <div className="flex flex-col gap-2">{footer}</div>
                ) : null}
            </div>
        </div>
    );
}
