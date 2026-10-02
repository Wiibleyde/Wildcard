import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { MaintenanceControl } from "@/components/admin/MaintenanceControl";
import { OngoingGamesPanel } from "@/components/admin/OngoingGamesPanel";
import { GameButton } from "@/components/ui/GameButton";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageShell } from "@/components/ui/PageShell";
import { redirect } from "@/i18n/navigation";
import { getUserRole, roleAtLeast } from "@/lib/auth/roles";
import { requireAuthUser } from "@/lib/auth/session";
import { listOngoingGames } from "@/lib/models/admin";
import { getAppSettings } from "@/lib/models/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({
    params,
}: {
    params: Promise<{ lang: Locale }>;
}): Promise<Metadata> {
    const { lang } = await params;
    const t = await getTranslations({ locale: lang, namespace: "admin" });
    return { title: t("title") };
}

export default async function AdminPage({
    params,
}: {
    params: Promise<{ lang: Locale }>;
}) {
    const { lang } = await params;
    setRequestLocale(lang);

    const user = await requireAuthUser(lang, `/${lang}/admin`);
    const supabase = await createClient();

    // In-app gate only; API writes re-check the role server-side.
    const role = await getUserRole(supabase, user.id);
    if (!roleAtLeast(role, "moderator")) {
        return redirect({ href: "/", locale: lang });
    }

    const isAdmin = role === "admin";
    const t = await getTranslations("admin");

    const [games, settings] = await Promise.all([
        // Service role: members-only room RLS would hide private-room games
        // from staff, who could then never force-end them. Gated above.
        listOngoingGames(createAdminClient()),
        isAdmin ? getAppSettings(supabase) : Promise.resolve(null),
    ]);

    return (
        <PageShell width="wide" className="flex flex-col gap-8">
            <PageHeader
                title={t("title")}
                subtitle={t("subtitle")}
                badge={
                    <span
                        className="stamp"
                        style={
                            isAdmin
                                ? {
                                      background: "var(--gold)",
                                      color: "var(--ink)",
                                  }
                                : {
                                      background: "var(--purple)",
                                      color: "var(--accent-ink)",
                                  }
                        }
                    >
                        {isAdmin ? t("role_admin") : t("role_moderator")}
                    </span>
                }
            >
                <div className="mt-1">
                    <GameButton variant="gold" size="sm" href="/admin/eca">
                        {t("eca_manage")}
                    </GameButton>
                </div>
            </PageHeader>

            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_22.5rem] xl:grid-cols-[1fr_25rem]">
                <OngoingGamesPanel games={games} canEnd={isAdmin} />
                {isAdmin && settings && (
                    <MaintenanceControl
                        initialEnabled={settings.maintenance}
                        initialMessage={settings.maintenanceMessage}
                    />
                )}
            </div>
        </PageShell>
    );
}
