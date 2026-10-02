import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { FriendsClient } from "@/components/profile/FriendsClient";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageShell } from "@/components/ui/PageShell";
import { requireAuthUser } from "@/lib/auth/session";
import { accountUrl } from "@/lib/auth/urls";

export async function generateMetadata({
    params,
}: {
    params: Promise<{ lang: Locale }>;
}): Promise<Metadata> {
    const { lang } = await params;
    const t = await getTranslations({ locale: lang, namespace: "friends" });
    return { title: t("title") };
}

export default async function Page({
    params,
}: {
    params: Promise<{ lang: Locale }>;
}) {
    const { lang } = await params;
    setRequestLocale(lang);
    const t = await getTranslations("friends");

    await requireAuthUser(lang, `/${lang}/profile/friends`);

    return (
        <PageShell>
            <PageHeader
                title={t("title")}
                subtitle={t("subtitle")}
                back={{ href: "/profile", label: t("back_to_profile") }}
            />
            {/* The friend list lives on the portal: none in local dev. */}
            {accountUrl() ? (
                <FriendsClient />
            ) : (
                <div className="panel-d p-6">
                    <p className="text-sm font-semibold text-wc-muted">
                        {t("dev_unavailable")}
                    </p>
                </div>
            )}
        </PageShell>
    );
}
