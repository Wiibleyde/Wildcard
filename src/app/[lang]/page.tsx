import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { GameCard } from "@/components/lobby/GameCard";
import { GameFan } from "@/components/lobby/GameFan";
import { GameButton } from "@/components/ui/GameButton";
import { PageShell } from "@/components/ui/PageShell";
import { buildPlayCatalog } from "@/lib/games/catalog";
import { gameLabels, type Translate } from "@/lib/games/catalogView";

const STEPS = [
    {
        suit: "♠",
        accent: "var(--red)",
        press: "var(--red-d)",
        title: "step1_title",
        desc: "step1_desc",
    },
    {
        suit: "♥",
        accent: "var(--orange)",
        press: "var(--orange-d)",
        title: "step2_title",
        desc: "step2_desc",
    },
    {
        suit: "♦",
        accent: "var(--blue)",
        press: "var(--blue-d)",
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

    const catalog = buildPlayCatalog();

    return (
        <PageShell width="wide" className="flex flex-col gap-12">
            <section className="grid items-center gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
                <div className="flex flex-col items-start gap-5">
                    <span className="stamp bg-wc-gold text-wc-ink">
                        {tHome("quick_play_stamp")}
                    </span>
                    <h1
                        className="font-display leading-[0.95] text-shadow"
                        style={{ fontSize: "clamp(42px, 6vw, 84px)" }}
                    >
                        {tHome("title")}
                    </h1>
                    <p className="sub max-w-md text-lg">
                        {tHome("hero_tagline")}
                    </p>
                    <GameButton href="/lobby" variant="orange" size="lg">
                        {tHome("cta_play")}
                    </GameButton>
                </div>
                <GameFan games={catalog} selectedId={null} />
            </section>

            <section className="flex flex-col gap-5">
                <h2 className="h-lg">{tHome("how_title")}</h2>
                <ol className="grid gap-4 md:grid-cols-3">
                    {STEPS.map((step) => (
                        <li key={step.suit} className="panel flex gap-4 p-5">
                            <span
                                aria-hidden="true"
                                className="grid h-12 w-12 shrink-0 place-items-center rounded-xl font-display text-2xl text-white text-shadow"
                                style={{
                                    background: step.accent,
                                    boxShadow: `0 4px 0 ${step.press}`,
                                }}
                            >
                                {step.suit}
                            </span>
                            <div className="flex flex-col gap-1">
                                <h3 className="font-display text-lg leading-tight">
                                    {tHome(step.title)}
                                </h3>
                                <p className="text-sm leading-snug text-wc-muted">
                                    {tHome(step.desc)}
                                </p>
                            </div>
                        </li>
                    ))}
                </ol>
            </section>

            <section className="flex flex-col gap-5">
                <h2 className="h-lg">{tHome("games_title")}</h2>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {catalog.map((g) => {
                        const { categoryLabel, description, meta } = gameLabels(
                            g,
                            tg,
                        );
                        return (
                            <GameCard
                                key={g.id}
                                game={g}
                                categoryLabel={categoryLabel}
                                description={description}
                                meta={meta}
                                footer={
                                    <GameButton
                                        href="/lobby"
                                        variant="green"
                                        size="sm"
                                    >
                                        {tHome("play_now")}
                                    </GameButton>
                                }
                            />
                        );
                    })}
                </div>
            </section>
        </PageShell>
    );
}
