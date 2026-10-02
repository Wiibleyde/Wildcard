import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
    type AdminEcaGameView,
    EcaGamesAdminPanel,
} from "@/components/admin/EcaGamesAdminPanel";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageShell } from "@/components/ui/PageShell";
import { redirect } from "@/i18n/navigation";
import { getUserRole, roleAtLeast } from "@/lib/auth/roles";
import { requireAuthUser } from "@/lib/auth/session";
import { listAllEcaGames } from "@/lib/models/adminStudio";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ecaImagesBucket, publicStorageUrl } from "@/lib/supabase/storage";

export async function generateMetadata({
    params,
}: {
    params: Promise<{ lang: Locale }>;
}): Promise<Metadata> {
    const { lang } = await params;
    const t = await getTranslations({ locale: lang, namespace: "admin" });
    return { title: t("eca_title") };
}

export default async function AdminEcaPage({
    params,
}: {
    params: Promise<{ lang: Locale }>;
}) {
    const { lang } = await params;
    setRequestLocale(lang);

    const user = await requireAuthUser(lang, `/${lang}/admin/eca`);
    const supabase = await createClient();

    // In-app gate only; the moderation API re-checks the admin role.
    const role = await getUserRole(supabase, user.id);
    if (!roleAtLeast(role, "moderator")) {
        return redirect({ href: "/", locale: lang });
    }

    const t = await getTranslations("admin");

    // Service role: RLS would hide other creators' drafts from a moderator. Gated above.
    const rows = await listAllEcaGames(createAdminClient());
    const games: AdminEcaGameView[] = rows.map((g) => ({
        id: g.id,
        ownerName: g.ownerName,
        name: g.name,
        description: g.description,
        status: g.status,
        moderationLocked: g.moderationLocked,
        imageUrl: g.imageUrl
            ? publicStorageUrl(ecaImagesBucket(), g.imageUrl)
            : null,
        updatedAt: g.updatedAt,
    }));

    return (
        <PageShell width="wide" className="flex flex-col gap-8">
            <PageHeader
                title={t("eca_title")}
                subtitle={t("eca_subtitle")}
                back={{ href: "/admin", label: t("eca_back") }}
            />
            <EcaGamesAdminPanel games={games} canManage={role === "admin"} />
        </PageShell>
    );
}
