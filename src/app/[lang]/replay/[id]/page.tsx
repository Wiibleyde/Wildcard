import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { ReplayClient } from "@/components/game/ReplayClient";
import { requireAuthUser } from "@/lib/auth/session";
import { getPlayerStyles } from "@/lib/models/customization";
import { getReplay } from "@/lib/models/replay";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export default async function Page({
    params,
}: {
    params: Promise<{ lang: Locale; id: string }>;
}) {
    const { lang, id } = await params;
    setRequestLocale(lang);

    const user = await requireAuthUser(lang, `/${lang}/replay/${id}`);
    const supabase = await createClient();

    // Service-role re-derivation: the client only gets per-frame redacted views.
    const result = await getReplay(createAdminClient(), id, user.id);
    if (!result.ok) {
        if (result.error === "db_error") {
            throw new Error(`replay ${id} failed to load`);
        }
        notFound();
    }

    const styles = await getPlayerStyles(supabase, user.id);

    return (
        <div className="min-h-screen px-4 xl:px-10 pt-6 pb-16">
            <ReplayClient
                payload={result.payload}
                currentUserId={user.id}
                deckStyleId={styles.deckStyleId}
                boardStyleId={styles.boardStyleId}
            />
        </div>
    );
}
