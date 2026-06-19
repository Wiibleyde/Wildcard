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

    // Service-role read: participation lives in the secret engine state, which
    // RLS denies to every client key. We only surface the public-safe
    // projection (game name, date, result, seat names) to the page.
    const admin = createAdminClient();
    const entries = await getMatchHistory(admin, user.id);

    return (
        <div
            className="min-h-screen px-4 xl:px-10 pt-6 md:pt-10 pb-16"
            style={{ background: "#0d0a05" }}
        >
            <div className="max-w-lg lg:max-w-3xl xl:max-w-5xl 2xl:max-w-6xl mx-auto flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                    <Link
                        href="/profile"
                        className="text-xs font-bold uppercase tracking-widest w-fit"
                        style={{ color: "#7a6a50" }}
                    >
                        ← {t("back_to_profile")}
                    </Link>
                    <h1
                        className="text-2xl xl:text-3xl font-black tracking-tight"
                        style={{ color: "#faf2e2" }}
                    >
                        {t("title")}
                    </h1>
                    <p
                        className="text-sm font-semibold"
                        style={{ color: "#9a8870" }}
                    >
                        {t("subtitle")}
                    </p>
                </div>

                <MatchHistoryClient entries={entries} />
            </div>
        </div>
    );
}
