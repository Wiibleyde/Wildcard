import { redirect } from "next/navigation";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { MaintenanceControl } from "@/components/admin/MaintenanceControl";
import { OngoingGamesPanel } from "@/components/admin/OngoingGamesPanel";
import { getUserRole, roleAtLeast } from "@/lib/auth/roles";
import { listOngoingGames } from "@/lib/models/admin";
import { getAppSettings } from "@/lib/models/settings";
import { createClient } from "@/lib/supabase/server";

export default async function AdminPage({
    params,
}: {
    params: Promise<{ lang: Locale }>;
}) {
    const { lang } = await params;
    setRequestLocale(lang);

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect(`/${lang}/login`);

    // In-app gate only; API writes re-check the role server-side (defense in depth).
    const role = await getUserRole(supabase, user.id);
    if (!roleAtLeast(role, "moderator")) redirect(`/${lang}`);

    const isAdmin = role === "admin";
    const t = await getTranslations("admin");

    const [games, settings] = await Promise.all([
        listOngoingGames(supabase),
        isAdmin ? getAppSettings(supabase) : Promise.resolve(null),
    ]);

    return (
        <div
            className="min-h-screen px-4 xl:px-10 pt-8 md:pt-12 pb-16"
            style={{ background: "#0d0a05" }}
        >
            <div className="max-w-lg lg:max-w-5xl xl:max-w-7xl mx-auto flex flex-col gap-8">
                <header className="flex flex-col gap-2">
                    <div className="flex items-center gap-3 flex-wrap">
                        <h1
                            className="text-2xl xl:text-3xl font-black"
                            style={{ color: "#faf2e2" }}
                        >
                            {t("title")}
                        </h1>
                        <span
                            className="text-[11px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider"
                            style={{
                                background: isAdmin
                                    ? "rgba(245,197,22,0.15)"
                                    : "rgba(167,139,250,0.15)",
                                color: isAdmin ? "#f5c516" : "#26ccba",
                                border: `1px solid ${isAdmin ? "rgba(245,197,22,0.3)" : "rgba(167,139,250,0.3)"}`,
                            }}
                        >
                            {isAdmin ? t("role_admin") : t("role_moderator")}
                        </span>
                    </div>
                    <p
                        className="text-sm font-semibold"
                        style={{ color: "#9a8870" }}
                    >
                        {t("subtitle")}
                    </p>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] xl:grid-cols-[1fr_400px] gap-6 items-start">
                    <OngoingGamesPanel games={games} canEnd={isAdmin} />

                    {isAdmin && settings && (
                        <MaintenanceControl
                            initialEnabled={settings.maintenance}
                            initialMessage={settings.maintenanceMessage}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
