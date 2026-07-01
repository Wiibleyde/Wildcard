import { redirect } from "next/navigation";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { MatchHistoryClient } from "@/components/profile/MatchHistoryClient";
import { Link } from "@/i18n/navigation";
import { getMatchHistory } from "@/lib/models/history";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export default async function Page({
    params,
}: {
    params: Promise<{ lang: Locale }>;
}) {
    const { lang } = await params;
    setRequestLocale(lang);
    const t = await getTranslations("history");

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect(`/${lang}/login`);

    // Service-role read: participation lives in RLS-denied engine state; only the public-safe projection reaches the page.
    const admin = createAdminClient();
    const entries = await getMatchHistory(admin, user.id);

    return (
        <div className="min-h-screen px-4 pt-6 pb-16 md:pt-10 xl:px-10">
            <div className="mx-auto flex max-w-lg flex-col gap-6 lg:max-w-3xl xl:max-w-5xl 2xl:max-w-6xl">
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

                <MatchHistoryClient entries={entries} />
            </div>
        </div>
    );
}
