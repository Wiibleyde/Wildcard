import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DecoSuit } from "@/components/brand/DecoSuit";
import { LogoCard } from "@/components/brand/LogoCard";
import { GameCard } from "@/components/lobby/GameCard";
import { GameButton } from "@/components/ui/GameButton";
import { Link } from "@/i18n/navigation";
import { buildPlayCatalog } from "@/lib/games/catalog";
import {
    buildPlaySections,
    gameLabels,
    type Translate,
} from "@/lib/games/catalogView";

const STEPS = [
    { suit: "♠", accent: "#f5c516" },
    { suit: "♥", accent: "#48c97a" },
    { suit: "♦", accent: "#ff9d3c" },
] as const;

export default async function Home({
    params,
}: {
    params: Promise<{ lang: Locale }>;
}) {
    const { lang } = await params;
    setRequestLocale(lang);
    const t = await getTranslations("navigation");
    const tHome = await getTranslations("home");
    // Loosen next-intl's strict key type for the catalog view's dynamic keys.
    const tg = (await getTranslations("games")) as unknown as Translate;

    const games = buildPlayCatalog();
    const sections = buildPlaySections(games, tg);

    return (
        <div
            className="min-h-screen px-4 pt-8 pb-16 md:pt-12 xl:px-10"
            style={{ background: "#0d0a05" }}
        >
            <div className="mx-auto flex max-w-lg flex-col gap-12 lg:max-w-5xl xl:max-w-7xl">
                {/* Hero */}
                <div
                    className="relative flex flex-col items-center overflow-hidden rounded-2xl px-8 py-12 text-center xl:py-16"
                    style={{
                        background:
                            "linear-gradient(160deg, #1e1408 0%, #0d0a05 60%)",
                        border: "2px solid #4a3822",
                        boxShadow:
                            "0 6px 0 0 rgba(0,0,0,0.45), 0 14px 30px rgba(0,0,0,0.5)",
                    }}
                >
                    <DecoSuit
                        suit="♠"
                        style={{
                            fontSize: "14rem",
                            opacity: 0.04,
                            color: "#f0e8d4",
                            top: "-2rem",
                            left: "-2rem",
                            transform: "rotate(-10deg)",
                        }}
                    />
                    <DecoSuit
                        suit="♥"
                        style={{
                            fontSize: "14rem",
                            opacity: 0.04,
                            color: "#e04040",
                            bottom: "-2rem",
                            right: "-2rem",
                            transform: "rotate(10deg)",
                        }}
                    />

                    <div className="relative z-10 flex flex-col items-center gap-6">
                        <LogoCard />

                        <div>
                            <h1
                                className="font-display text-5xl font-extrabold tracking-tight xl:text-6xl"
                                style={{ color: "#faf2e2" }}
                            >
                                Wildcard
                            </h1>
                            <p
                                className="mx-auto mt-3 max-w-md text-lg font-semibold"
                                style={{ color: "#9a8870" }}
                            >
                                {tHome("hero_tagline")}
                            </p>
                        </div>

                        <div className="flex flex-col items-center gap-3 sm:flex-row">
                            <GameButton href="/lobby" variant="green" size="lg">
                                <span style={{ fontSize: "1.1em" }}>♠</span>
                                {tHome("cta_play")}
                                <span style={{ fontSize: "1.1em" }}>♥</span>
                            </GameButton>
                            <Link
                                href="/leaderboard"
                                className="rounded-xl px-6 py-3 text-sm font-bold transition-transform active:scale-95"
                                style={{
                                    background: "rgba(255,255,255,0.04)",
                                    color: "#faf2e2",
                                    border: "2px solid #3d2d18",
                                }}
                            >
                                {t("leaderboard")}
                            </Link>
                        </div>
                    </div>
                </div>

                {/* How it works — a connected "play the hand" flow rather than
                    three identical numbered feature cards. Suit pips are the
                    nodes; a thin line threads them like a trick being played. */}
                <div className="flex flex-col gap-7">
                    <h2
                        className="font-display text-2xl font-extrabold xl:text-3xl"
                        style={{ color: "#faf2e2" }}
                    >
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
                                                "linear-gradient(90deg, #4a3a22, transparent)",
                                        }}
                                    />
                                )}
                                <span
                                    className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-2xl"
                                    style={{
                                        background: "#1c1510",
                                        color: step.accent,
                                        border: `1.5px solid ${step.accent}66`,
                                        boxShadow: `0 0 18px ${step.accent}1f`,
                                    }}
                                >
                                    {step.suit}
                                </span>
                                <div className="flex flex-col gap-1.5">
                                    <h3
                                        className="font-display text-lg font-extrabold leading-tight"
                                        style={{ color: "#faf2e2" }}
                                    >
                                        {tHome(
                                            `step${i + 1}_title` as "step1_title",
                                        )}
                                    </h3>
                                    <p
                                        className="text-sm font-semibold leading-snug"
                                        style={{ color: "#9a8870" }}
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
                    <h2
                        className="font-display text-2xl font-extrabold xl:text-3xl"
                        style={{ color: "#faf2e2" }}
                    >
                        {tHome("games_title")}
                    </h2>
                    {sections.map((section) => (
                        <section
                            key={section.id}
                            className="flex flex-col gap-4"
                        >
                            <div className="flex items-center gap-3">
                                <h3
                                    className="text-xs font-bold uppercase tracking-widest"
                                    style={{ color: section.accent }}
                                >
                                    {section.label}
                                </h3>
                                <span
                                    className="h-px flex-1"
                                    style={{ background: "#2a2012" }}
                                />
                            </div>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                                {section.games.map((g) => {
                                    const { categoryLabel, description, meta } =
                                        gameLabels(g, tg);
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
                                                    className="flex items-center justify-center rounded-xl py-2.5 font-black text-sm transition-transform active:scale-95"
                                                    style={{
                                                        background: g.accent,
                                                        color: "#0d0a05",
                                                        boxShadow: `0 3px 0 0 ${g.shadow}`,
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
                    ))}
                </div>
            </div>
        </div>
    );
}
