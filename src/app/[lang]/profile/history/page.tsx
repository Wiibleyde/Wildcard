import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { MatchHistoryClient } from "@/components/profile/MatchHistoryClient";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageShell } from "@/components/ui/PageShell";
import { requireAuthUser } from "@/lib/auth/session";
import { getMatchHistory } from "@/lib/models/history";
import { createAdminClient } from "@/lib/supabase/admin";

export async function generateMetadata({
    params,
}: {
    params: Promise<{ lang: Locale }>;
}): Promise<Metadata> {
    const { lang } = await params;
    const t = await getTranslations({ locale: lang, namespace: "history" });
    return { title: t("title") };
}

export default async function Page({
    params,
}: {
    params: Promise<{ lang: Locale }>;
}) {
    const { lang } = await params;
    setRequestLocale(lang);
    const t = await getTranslations("history");

    const user = await requireAuthUser(lang, `/${lang}/profile/history`);
    // Service role: participation lives in RLS-denied engine state; only the public-safe projection is returned.
    const entries = await getMatchHistory(createAdminClient(), user.id);

    return (
        <PageShell width="narrow">
            <PageHeader
                title={t("title")}
                subtitle={t("subtitle")}
                back={{ href: "/profile", label: t("back_to_profile") }}
            />
            <MatchHistoryClient entries={entries} />
        </PageShell>
    );
}
