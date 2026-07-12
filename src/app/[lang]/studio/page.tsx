import { redirect } from "next/navigation";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
    type StudioGameSummary,
    StudioHub,
} from "@/components/studio/StudioHub";
import { createClient } from "@/lib/supabase/server";
import { publicStorageUrl } from "@/lib/supabase/storage";

export default async function Page({
    params,
}: {
    params: Promise<{ lang: Locale }>;
}) {
    const { lang } = await params;
    setRequestLocale(lang);
    const t = await getTranslations("studio");

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect(`/${lang}/login`);

    // RLS client on purpose: the own-row select policy scopes this query —
    // database-level defense-in-depth under the API's ownership checks.
    const { data } = await supabase
        .from("eca_games")
        .select(
            "id, name, description, status, image_url, definition, updated_at",
        )
        .eq("owner_id", user.id)
        .order("updated_at", { ascending: false });

    const games: StudioGameSummary[] = (data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        status: row.status,
        ruleCount: Array.isArray(row.definition.rules)
            ? row.definition.rules.length
            : 0,
        imageUrl: row.image_url
            ? publicStorageUrl("eca-images", row.image_url)
            : null,
        updatedAt: row.updated_at,
    }));

    return (
        <div className="min-h-screen px-4 pt-8 pb-16 md:pt-12 xl:px-10">
            <div className="mx-auto flex max-w-lg flex-col gap-8 lg:max-w-5xl xl:max-w-7xl">
                <header className="flex flex-col gap-1.5">
                    <h1 className="h-xl text-3xl xl:text-4xl">{t("title")}</h1>
                    <p className="sub text-sm">{t("subtitle")}</p>
                </header>
                <StudioHub games={games} />
            </div>
        </div>
    );
}
