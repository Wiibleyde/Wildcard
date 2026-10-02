import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PlayHub } from "@/components/lobby/PlayHub";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageShell } from "@/components/ui/PageShell";
import { requireAuthUser } from "@/lib/auth/session";
import { buildPlayCatalog } from "@/lib/games/catalog";
import { listPublishedEcaGames } from "@/lib/models/studio";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({
    params,
}: {
    params: Promise<{ lang: Locale }>;
}): Promise<Metadata> {
    const { lang } = await params;
    const t = await getTranslations({ locale: lang, namespace: "lobby" });
    return { title: t("title"), description: t("subtitle") };
}

export default async function Page({
    params,
}: {
    params: Promise<{ lang: Locale }>;
}) {
    const { lang } = await params;
    setRequestLocale(lang);
    const t = await getTranslations("lobby");

    const user = await requireAuthUser(lang, `/${lang}/lobby`);
    const community = await listPublishedEcaGames(await createClient());

    return (
        <PageShell width="wide" className="flex flex-col gap-8">
            <PageHeader title={t("title")} subtitle={t("subtitle")} />
            <PlayHub
                userId={user.id}
                games={buildPlayCatalog()}
                community={community}
            />
        </PageShell>
    );
}
