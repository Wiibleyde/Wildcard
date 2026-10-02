import { redirect } from "next/navigation";
import type { Locale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { EcaEditor } from "@/components/studio/EcaEditor";
import { requireAuthUser } from "@/lib/auth/session";
import { isUuid } from "@/lib/eca/id";
import { validateEcaDefinition } from "@/lib/eca/validate";
import { createClient } from "@/lib/supabase/server";

export default async function Page({
    params,
}: {
    params: Promise<{ lang: Locale; id: string }>;
}) {
    const { lang, id } = await params;
    setRequestLocale(lang);

    const user = await requireAuthUser(lang, `/${lang}/studio/${id}`);
    if (!isUuid(id)) redirect(`/${lang}/studio`);
    const supabase = await createClient();

    // Published foreign games pass RLS: readable, but not editable.
    const { data } = await supabase
        .from("eca_games")
        .select(
            "id, owner_id, name, description, status, image_url, definition, moderation_locked",
        )
        .eq("id", id)
        .maybeSingle();
    if (!data || data.owner_id !== user.id) redirect(`/${lang}/studio`);

    const validated = validateEcaDefinition(data.definition);
    if (!validated.ok) redirect(`/${lang}/studio`);

    return (
        <div className="min-h-screen px-4 pt-8 pb-16 md:pt-12 xl:px-10">
            <div className="mx-auto flex max-w-lg flex-col gap-8 lg:max-w-5xl xl:max-w-7xl">
                <EcaEditor
                    initialGame={{
                        id: data.id,
                        ownerId: data.owner_id,
                        name: data.name,
                        description: data.description,
                        status: data.status,
                        moderationLocked: data.moderation_locked,
                        imageUrl: data.image_url,
                        definition: validated.definition,
                    }}
                />
            </div>
        </div>
    );
}
