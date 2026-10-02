import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DecoSuit } from "@/components/brand/DecoSuit";
import { GameCard } from "@/components/lobby/GameCard";
import { GameButton } from "@/components/ui/GameButton";
import { PageShell } from "@/components/ui/PageShell";
import { Link } from "@/i18n/navigation";
import { buildPlayCatalog } from "@/lib/games/catalog";
import {
    buildPlaySections,
    gameLabels,
    type Translate,
} from "@/lib/games/catalogView";

const STEPS = [
    {
        suit: "♠",
        accent: "var(--red)",
        ink: "var(--accent-ink)",
        title: "step1_title",
        desc: "step1_desc",
    },
    {
        suit: "♥",
        accent: "var(--gold)",
        ink: "var(--ink)",
        title: "step2_title",
        desc: "step2_desc",
    },
    {
        suit: "♦",
        accent: "var(--blue)",
        ink: "var(--accent-ink)",
        title: "step3_title",
        desc: "step3_desc",
    },
] as const;

export async function generateMetadata({
    params,
}: {
    params: Promise<{ lang: Locale }>;
}): Promise<Metadata> {
    const { lang } = await params;
    const t = await getTranslations({ locale: lang, namespace: "home" });
    return { title: { absolute: t("title") }, description: t("subtitle") };
}

export default async function Home({
    params,
}: {
    params: Promise<{ lang: Locale }>;
}) {
    const { lang } = await params;
    setRequestLocale(lang);
    const tHome = await getTranslations("home");
    // catalogView builds its keys dynamically (`cat_${id}`) and takes a loose translator.
    const tg = (await getTranslations("games")) as unknown as Translate;

    const sections = buildPlaySections(buildPlayCatalog(), tg);

    return (
        <PageShell width="wide" className="flex flex-col gap-12">
            <div
                className="panel-d lift relative flex flex-col items-center overflow-hidden px-8 py-12 text-center xl:py-16"
                style={{ borderRadius: 20, boxShadow: "0 8px 0 var(--ink)" }}
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
                        {tHome("quick_play_stamp")}
                    </span>

                    <div>
                        <h1 className="h-xl">{tHome("title")}</h1>
                        <p className="sub mx-auto mt-3 max-w-md text-lg">
                            {tHome("hero_tagline")}
                        </p>
                    </div>

                    <GameButton href="/lobby" variant="red" size="lg">
                        <span aria-hidden="true" className="text-[1.1em]">
                            ♠
                        </span>
                        {tHome("cta_play")}
                        <span aria-hidden="true" className="text-[1.1em]">
                            ♥
                        </span>
                    </GameButton>
                </div>
            </div>

            <div className="flex flex-col gap-7">
                <h2 className="font-display text-2xl text-wc-cream xl:text-3xl">
                    {tHome("how_title")}
                </h2>
                <ol className="flex flex-col gap-9 sm:flex-row sm:gap-0">
                    {STEPS.map((step, i) => (
                        <li
                            key={step.suit}
                            className="relative flex flex-1 gap-4 sm:flex-col sm:gap-4 sm:pr-8"
                        >
                            {i < STEPS.length - 1 && (
                                <span
                                    aria-hidden="true"
                                    className="absolute top-6 left-12 hidden h-px w-[calc(100%-3rem)] sm:block"
                                    style={{
                                        background:
                                            "linear-gradient(90deg, var(--panel-d), transparent)",
                                    }}
                                />
                            )}
                            <span
                                aria-hidden="true"
                                className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-nb border-wc-ink font-display text-2xl"
                                style={{
                                    background: step.accent,
                                    color: step.ink,
                                    boxShadow: "0 4px 0 var(--ink)",
                                }}
                            >
                                {step.suit}
                            </span>
                            <div className="flex flex-col gap-1.5">
                                <h3 className="font-display text-lg leading-tight text-wc-cream">
                                    {tHome(step.title)}
                                </h3>
                                <p className="text-sm font-semibold leading-snug text-wc-muted">
                                    {tHome(step.desc)}
                                </p>
                            </div>
                        </li>
                    ))}
                </ol>
            </div>

            <div className="flex flex-col gap-8">
                <h2 className="font-display text-2xl text-wc-cream xl:text-3xl">
                    {tHome("games_title")}
                </h2>
                {sections.map((section) => (
                    <section key={section.id} className="flex flex-col gap-4">
                        <div className="flex items-center gap-3">
                            <h3 className="font-display text-2xl text-wc-cream xl:text-3xl">
                                {section.label}
                            </h3>
                            <span className="h-0.5 flex-1 bg-wc-panel-d" />
                        </div>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
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
                                            // Same accent + ink as the /lobby section chips.
                                            <Link
                                                href="/lobby"
                                                className="flex items-center justify-center rounded-[13px] border-nb border-wc-ink py-2.5 font-display text-sm text-wc-ink transition-transform active:scale-95"
                                                style={{
                                                    background: section.accent,
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
                ))}
            </div>
        </PageShell>
    );
}
