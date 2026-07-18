import { redirect } from "next/navigation";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
    type AdminEcaGameView,
    EcaGamesAdminPanel,
} from "@/components/admin/EcaGamesAdminPanel";
import { GameButton } from "@/components/ui/GameButton";
import { getUserRole, roleAtLeast } from "@/lib/auth/roles";
import { listAllEcaGames } from "@/lib/models/adminStudio";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { publicStorageUrl } from "@/lib/supabase/storage";

export default async function AdminEcaPage({
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

    // In-app gate only; the moderation API re-checks the admin role server-side.
    const role = await getUserRole(supabase, user.id);
    if (!roleAtLeast(role, "moderator")) redirect(`/${lang}`);
    const canManage = role === "admin";

    const t = await getTranslations("admin");

    // Service-role read: the RLS select policy would hide other creators'
    // drafts from a moderator, so the cross-owner listing runs on the admin
    // client — safe here because the role gate above already passed.
    const admin = createAdminClient();
    const rows = await listAllEcaGames(admin);
    const games: AdminEcaGameView[] = rows.map((g) => ({
        id: g.id,
        ownerName: g.ownerName,
        name: g.name,
        description: g.description,
        status: g.status,
        imageUrl: g.imageUrl
            ? publicStorageUrl("eca-images", g.imageUrl)
            : null,
        updatedAt: g.updatedAt,
    }));

    return (
        <div className="min-h-screen px-4 pt-8 pb-16 md:pt-12 xl:px-10">
            <div className="mx-auto flex max-w-lg flex-col gap-8 lg:max-w-5xl xl:max-w-7xl">
                <header className="flex flex-col gap-2">
                    <div>
                        <GameButton variant="ghost" size="sm" href="/admin">
                            ← {t("eca_back")}
                        </GameButton>
                    </div>
                    <h1 className="h-xl text-2xl xl:text-3xl">
                        {t("eca_title")}
                    </h1>
                    <p className="sub text-sm">{t("eca_subtitle")}</p>
                </header>

                <EcaGamesAdminPanel games={games} canManage={canManage} />
            </div>
        </div>
    );
}
