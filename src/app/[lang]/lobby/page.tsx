import { redirect } from "next/navigation";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PlayHub } from "@/components/lobby/PlayHub";
import { buildPlayCatalog } from "@/lib/games/catalog";
import { createClient } from "@/lib/supabase/server";

export default async function Page({
    params,
}: {
    params: Promise<{ lang: Locale }>;
}) {
    const { lang } = await params;
    setRequestLocale(lang);
    const t = await getTranslations("lobby");

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect(`/${lang}/login`);

    const games = buildPlayCatalog();

    return (
        <div className="min-h-screen px-4 pt-8 pb-16 md:pt-12 xl:px-10">
            <div className="mx-auto flex max-w-lg flex-col gap-8 lg:max-w-5xl xl:max-w-7xl">
                <header className="flex flex-col gap-1.5">
                    <h1 className="h-xl text-3xl xl:text-4xl">{t("title")}</h1>
                    <p className="sub text-sm">{t("subtitle")}</p>
                </header>
                <PlayHub userId={user.id} games={games} />
            </div>
        </div>
    );
}
