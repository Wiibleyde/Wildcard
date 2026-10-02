import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { FriendsClient } from "@/components/profile/FriendsClient";
import { Link } from "@/i18n/navigation";
import { requireAuthUser } from "@/lib/auth/session";
import { accountUrl } from "@/lib/auth/urls";

export async function generateMetadata({
    params,
}: {
    params: Promise<{ lang: Locale }>;
}) {
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
    // The friend list belongs to the portal: without one (local dev) there is
    // nothing to show.
    const manageUrl = accountUrl();

    return (
        <div className="min-h-screen px-4 pt-6 pb-16 md:pt-10 xl:px-10">
            <div className="mx-auto flex max-w-lg flex-col gap-6 lg:max-w-4xl xl:max-w-6xl 2xl:max-w-7xl">
                <div className="flex flex-col gap-2">
                    <Link
                        href="/profile"
                        className="w-fit font-display text-sm"
                        style={{ color: "var(--muted)" }}
                    >
                        ← {t("back_to_profile")}
                    </Link>
                    <h1
                        className="font-display text-3xl xl:text-4xl"
                        style={{ color: "var(--cream)" }}
                    >
                        {t("title")}
                    </h1>
                    <p
                        className="text-sm font-semibold"
                        style={{ color: "var(--muted)" }}
                    >
                        {t("subtitle")}
                    </p>
                </div>

                {manageUrl ? (
                    <FriendsClient />
                ) : (
                    <div className="panel-d p-6">
                        <p
                            className="text-sm font-semibold"
                            style={{ color: "var(--muted)" }}
                        >
                            {t("dev_unavailable")}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
