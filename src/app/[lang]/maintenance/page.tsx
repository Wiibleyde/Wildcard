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
        <div
            className="min-h-screen flex items-center justify-center px-4"
            style={{ background: "#0d0a05" }}
        >
            <div className="max-w-md w-full flex flex-col items-center gap-6 text-center">
                <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
                    style={{
                        background: "linear-gradient(135deg, #f5c516, #c49010)",
                        color: "#0d0a05",
                        boxShadow: "0 0 30px rgba(245,197,22,0.3)",
                    }}
                >
                    ♠
                </div>
                <div className="flex flex-col gap-2">
                    <h1
                        className="text-2xl xl:text-3xl font-black"
                        style={{ color: "#faf2e2" }}
                    >
                        {t("title")}
                    </h1>
                    <p
                        className="text-sm font-semibold"
                        style={{ color: "#9a8870" }}
                    >
                        {maintenanceMessage ?? t("description")}
                    </p>
                </div>
            </div>
        </div>
    );
}
