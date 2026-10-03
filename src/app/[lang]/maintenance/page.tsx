import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getAppSettings } from "@/lib/models/settings";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({
    params,
}: {
    params: Promise<{ lang: Locale }>;
}): Promise<Metadata> {
    const { lang } = await params;
    const t = await getTranslations({ locale: lang, namespace: "maintenance" });
    return { title: t("title") };
}

export default async function MaintenancePage({
    params,
}: {
    params: Promise<{ lang: Locale }>;
}) {
    const { lang } = await params;
    setRequestLocale(lang);
    const t = await getTranslations("maintenance");

    const { maintenanceMessage } = await getAppSettings(await createClient());

    return (
        <div className="flex min-h-screen items-center justify-center px-4 xl:px-10">
            <div className="panel flex w-full max-w-md flex-col items-center gap-6 px-6 py-10 text-center lg:max-w-lg xl:max-w-xl xl:px-10 xl:py-12 2xl:max-w-2xl">
                <div
                    aria-hidden="true"
                    className="flex h-16 w-16 -rotate-4 items-center justify-center rounded-xl bg-wc-gold text-3xl text-wc-ink shadow-[0_4px_0_var(--gold-d)]"
                >
                    ♠
                </div>
                <div className="flex flex-col gap-2">
                    <h1 className="font-display text-3xl leading-none xl:text-4xl">
                        {t("title")}
                    </h1>
                    <p className="text-sm font-semibold text-wc-muted xl:text-base">
                        {maintenanceMessage ?? t("description")}
                    </p>
                </div>
            </div>
        </div>
    );
}
