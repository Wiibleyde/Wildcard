import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DecoSuit } from "@/components/brand/DecoSuit";
import { GameCard } from "@/components/lobby/GameCard";
import { GameButton } from "@/components/ui/GameButton";
import { Link } from "@/i18n/navigation";
import type { GameCategoryId } from "@/lib/games/catalog";
import { buildPlayCatalog } from "@/lib/games/catalog";
import {
    buildPlaySections,
    gameLabels,
    type Translate,
} from "@/lib/games/catalogView";

/**
 * Neobrutalism accent map. The catalog carries legacy display hex; here we
 * re-key each category onto the v2 palette tokens so no old-palette colour
 * reaches the DOM. `light` accents (gold/green) take ink text, saturated
 * ones (red/blue/purple) take the cream accent-ink.
 */
const CATEGORY_ACCENT: Record<GameCategoryId, { bg: string; ink: string }> = {
    duel: { bg: "var(--red)", ink: "var(--accent-ink)" },
    shedding: { bg: "var(--gold)", ink: "var(--ink)" },
    trick: { bg: "var(--blue)", ink: "var(--accent-ink)" },
    solo: { bg: "var(--green)", ink: "var(--ink)" },
    party: { bg: "var(--purple)", ink: "var(--accent-ink)" },
};

const STEPS = [
    { suit: "♠", accent: "var(--red)", ink: "var(--accent-ink)" },
    { suit: "♥", accent: "var(--gold)", ink: "var(--ink)" },
    { suit: "♦", accent: "var(--blue)", ink: "var(--accent-ink)" },
] as const;

export default async function Home({
    params,
}: {
    params: Promise<{ lang: Locale }>;
}) {
    const { lang } = await params;
    setRequestLocale(lang);
    const tHome = await getTranslations("home");
    // Loosen next-intl's strict key type for the catalog view's dynamic keys.
    const tg = (await getTranslations("games")) as unknown as Translate;

    const games = buildPlayCatalog();
    const sections = buildPlaySections(games, tg);

    return (
        <div className="min-h-screen px-4 pt-8 pb-16 md:pt-12 xl:px-10">
            <div className="mx-auto flex max-w-lg flex-col gap-12 lg:max-w-5xl xl:max-w-7xl">
                {/* Hero */}
                <div
                    className="panel-d lift relative flex flex-col items-center overflow-hidden px-8 py-12 text-center xl:py-16"
                    style={{
                        borderRadius: 20,
                        boxShadow: "0 8px 0 var(--ink)",
                    }}
                >
                    <DecoSuit
                        suit="♠"
                        style={{
                            fontSize: "14rem",
                            opacity: 0.06,
                            color: "var(--cream)",
                            top: "-2rem",
                            left: "-2rem",
                            transform: "rotate(-10deg)",
                        }}
                    />
                    <DecoSuit
                        suit="♥"
                        style={{
                            fontSize: "14rem",
                            opacity: 0.14,
                            color: "var(--red)",
                            bottom: "-2rem",
                            right: "-2rem",
                            transform: "rotate(10deg)",
                        }}
                    />

                    <div className="relative z-10 flex flex-col items-center gap-6">
                        <span
                            className="stamp"
                            style={{
                                background: "var(--gold)",
                                color: "var(--ink)",
                            }}
                        >
                            ★ QUICK PLAY
                        </span>

                        <div>
                            <h1 className="h-xl text-5xl xl:text-6xl">
                                Wildcard
                            </h1>
                            <p
                                className="sub mx-auto mt-3 max-w-md text-lg"
                                style={{ color: "var(--muted)" }}
                            >
                                {tHome("hero_tagline")}
                            </p>
                        </div>

                        <GameButton href="/lobby" variant="red" size="lg">
                            <span style={{ fontSize: "1.1em" }}>♠</span>
                            {tHome("cta_play")}
                            <span style={{ fontSize: "1.1em" }}>♥</span>
                        </GameButton>
                    </div>
                </div>

                {/* How it works — a connected "play the hand" flow rather than
                    three identical numbered feature cards. Suit pips are chunky
                    tiles; a thin line threads them like a trick being played. */}
                <div className="flex flex-col gap-7">
                    <h2 className="font-display text-2xl font-extrabold text-wc-cream xl:text-3xl">
                        {tHome("how_title")}
                    </h2>
                    <ol className="flex flex-col gap-9 sm:flex-row sm:gap-0">
                        {STEPS.map((step, i) => (
                            <li
                                key={step.suit}
                                className="relative flex flex-1 gap-4 sm:flex-col sm:gap-4 sm:pr-8"
                            >
                                {/* thread to the next node (desktop only) */}
                                {i < STEPS.length - 1 && (
                                    <span
                                        aria-hidden
                                        className="absolute top-6 left-12 hidden h-px w-[calc(100%-3rem)] sm:block"
                                        style={{
                                            background:
                                                "linear-gradient(90deg, var(--panel-d), transparent)",
                                        }}
                                    />
                                )}
                                <span
                                    className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center font-display text-2xl"
                                    style={{
                                        background: step.accent,
                                        color: step.ink,
                                        border: "2.5px solid var(--ink)",
                                        borderRadius: 12,
                                        boxShadow: "0 4px 0 var(--ink)",
                                    }}
                                >
                                    {step.suit}
                                </span>
                                <div className="flex flex-col gap-1.5">
                                    <h3 className="font-display text-lg font-extrabold leading-tight text-wc-cream">
                                        {tHome(
                                            `step${i + 1}_title` as "step1_title",
                                        )}
                                    </h3>
                                    <p
                                        className="text-sm font-semibold leading-snug"
                                        style={{ color: "var(--muted)" }}
                                    >
                                        {tHome(
                                            `step${i + 1}_desc` as "step1_desc",
                                        )}
                                    </p>
                                </div>
                            </li>
                        ))}
                    </ol>
                </div>

                {/* Games by category */}
                <div className="flex flex-col gap-8">
                    <h2 className="font-display text-2xl font-extrabold text-wc-cream xl:text-3xl">
                        {tHome("games_title")}
                    </h2>
                    {sections.map((section) => {
                        const accent = CATEGORY_ACCENT[section.id];
                        return (
                            <section
                                key={section.id}
                                className="flex flex-col gap-4"
                            >
                                <div className="flex items-center gap-3">
                                    <h3 className="font-display text-2xl font-extrabold text-wc-cream xl:text-3xl">
                                        {section.label}
                                    </h3>
                                    <span
                                        className="h-0.5 flex-1"
                                        style={{ background: "var(--panel-d)" }}
                                    />
                                </div>
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                                    {section.games.map((g) => {
                                        const {
                                            categoryLabel,
                                            description,
                                            meta,
                                        } = gameLabels(g, tg);
                                        return (
                                            <GameCard
                                                key={g.id}
                                                game={g}
                                                categoryLabel={categoryLabel}
                                                description={description}
                                                meta={meta}
                                                footer={
                                                    <Link
                                                        href="/lobby"
                                                        className="flex items-center justify-center py-2.5 font-display text-sm font-black transition-transform active:scale-95"
                                                        style={{
                                                            background:
                                                                accent.bg,
                                                            color: accent.ink,
                                                            border: "2.5px solid var(--ink)",
                                                            borderRadius: 13,
                                                            boxShadow:
                                                                "0 4px 0 var(--ink)",
                                                        }}
                                                    >
                                                        {tHome("play_now")}
                                                    </Link>
                                                }
                                            />
                                        );
                                    })}
                                </div>
                            </section>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
