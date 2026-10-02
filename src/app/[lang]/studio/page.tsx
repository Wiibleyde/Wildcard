import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { StudioGameSummary } from "@/components/studio/StudioGameCard";
import { StudioHub } from "@/components/studio/StudioHub";
import { requireAuthUser } from "@/lib/auth/session";
import { listEcaGames } from "@/lib/models/studio";
import { createClient } from "@/lib/supabase/server";
import { ecaImagesBucket, publicStorageUrl } from "@/lib/supabase/storage";

export default async function Page({
    params,
}: {
    params: Promise<{ lang: Locale }>;
}) {
    const { lang } = await params;
    setRequestLocale(lang);
    const t = await getTranslations("studio");

    const user = await requireAuthUser(lang, `/${lang}/studio`);
    // RLS client on purpose: defense in depth under the owner filter.
    const result = await listEcaGames(await createClient(), user.id);
    const games: StudioGameSummary[] = result.ok
        ? result.games.map((game) => ({
              ...game,
              imageUrl: game.imageUrl
                  ? publicStorageUrl(ecaImagesBucket(), game.imageUrl)
                  : null,
          }))
        : [];

    return (
        <div className="min-h-screen px-4 pt-8 pb-16 md:pt-12 xl:px-10">
            <div className="mx-auto flex max-w-lg flex-col gap-8 lg:max-w-5xl xl:max-w-7xl">
                <header className="flex flex-col gap-1.5">
                    <h1 className="h-xl text-3xl xl:text-4xl">{t("title")}</h1>
                    <p className="sub text-sm">{t("subtitle")}</p>
                </header>
                <StudioHub games={games} />
            </div>
        </div>
    );
}
