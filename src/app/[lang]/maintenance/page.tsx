import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getAppSettings } from "@/lib/models/settings";
import { createClient } from "@/lib/supabase/server";

export default async function MaintenancePage({
    params,
}: {
    params: Promise<{ lang: Locale }>;
}) {
    const { lang } = await params;
    setRequestLocale(lang);
    const t = await getTranslations("maintenance");

    const supabase = await createClient();
    const { maintenanceMessage } = await getAppSettings(supabase);

    return (
        <div className="min-h-screen flex items-center justify-center px-4">
            <div
                className="panel max-w-md w-full flex flex-col items-center gap-6 text-center px-6 py-10 xl:px-10 xl:py-12"
                style={{ boxShadow: "0 8px 0 var(--ink)" }}
            >
                <div
                    className="w-16 h-16 flex items-center justify-center text-3xl"
                    style={{
                        background: "var(--gold)",
                        color: "var(--ink)",
                        border: "2.5px solid var(--ink)",
                        borderRadius: 12,
                        boxShadow: "0 4px 0 var(--ink)",
                        transform: "rotate(-4deg)",
                    }}
                >
                    ♠
                </div>
                <div className="flex flex-col gap-2">
                    <h1 className="font-display text-3xl xl:text-4xl leading-none">
                        {t("title")}
                    </h1>
                    <p
                        className="text-sm font-semibold"
                        style={{ color: "#5a5340" }}
                    >
                        {maintenanceMessage ?? t("description")}
                    </p>
                </div>
            </div>
        </div>
    );
}
