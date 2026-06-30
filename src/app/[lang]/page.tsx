import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DecoSuit } from "@/components/brand/DecoSuit";
import { LogoCard } from "@/components/brand/LogoCard";
import { GameCard } from "@/components/lobby/GameCard";
import { GameButton } from "@/components/ui/GameButton";
import { Link } from "@/i18n/navigation";
import {
    buildPlayCatalog,
    GAME_CATEGORIES,
    type PlayGame,
} from "@/lib/games/catalog";

const DIFFICULTY_KEY = [
    "",
    "difficulty_easy",
    "difficulty_medium",
    "difficulty_hard",
] as const;

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
    const tg = await getTranslations("games");

    const games = buildPlayCatalog();
    const sections = GAME_CATEGORIES.map((cat) => ({
        id: cat.id,
        accent: cat.accent,
        label: tg(`cat_${cat.id}` as "cat_duel"),
        games: games.filter((g) => g.category === cat.id),
    })).filter((s) => s.games.length > 0);

    function metaFor(g: PlayGame) {
        const players =
            g.maxPlayers === 1
                ? tg("players_solo")
                : g.minPlayers === g.maxPlayers
                  ? tg("players_exact", { n: g.minPlayers })
                  : tg("players_range", {
                        min: g.minPlayers,
                        max: g.maxPlayers,
                    });
        return {
            categoryLabel: tg(`cat_${g.category}` as "cat_duel"),
            description: tg(`desc_${g.id}` as "desc_bataille"),
            meta: {
                players,
                duration: tg("duration", { min: g.durationMin }),
                difficulty: tg(DIFFICULTY_KEY[g.difficulty]),
                comingSoon: tg("coming_soon"),
            },
        };
    }

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
                        border: "2px solid #3d2d18",
                        boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
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
                                className="text-5xl font-black tracking-tight xl:text-6xl"
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

                {/* How it works */}
                <div className="flex flex-col gap-5">
                    <h2
                        className="text-xs font-bold uppercase tracking-widest"
                        style={{ color: "#7a6a50" }}
                    >
                        {tHome("how_title")}
                    </h2>
                    <div className="grid gap-4 sm:grid-cols-3">
                        {STEPS.map((step, i) => (
                            <div
                                key={step.suit}
                                className="relative flex flex-col gap-2 overflow-hidden rounded-2xl p-5"
                                style={{
                                    background: "#1c1510",
                                    border: "2px solid #3d2d18",
                                }}
                            >
                                <div className="flex items-center gap-3">
                                    <span
                                        className="flex h-9 w-9 items-center justify-center rounded-lg text-lg font-black"
                                        style={{
                                            background: `${step.accent}1a`,
                                            color: step.accent,
                                        }}
                                    >
                                        {step.suit}
                                    </span>
                                    <span
                                        className="text-xs font-black uppercase tracking-widest"
                                        style={{ color: step.accent }}
                                    >
                                        {tHome("step")} {i + 1}
                                    </span>
                                </div>
                                <h3
                                    className="text-base font-black leading-tight"
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
                                    {tHome(`step${i + 1}_desc` as "step1_desc")}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Games by category */}
                <div className="flex flex-col gap-8">
                    <h2
                        className="text-2xl font-black xl:text-3xl"
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
                                        metaFor(g);
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
