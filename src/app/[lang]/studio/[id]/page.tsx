import { redirect } from "next/navigation";
import type { Locale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { EcaEditor } from "@/components/studio/EcaEditor";
import { validateEcaDefinition } from "@/lib/eca";
import { createClient } from "@/lib/supabase/server";

export default async function Page({
    params,
}: {
    params: Promise<{ lang: Locale; id: string }>;
}) {
    const { lang, id } = await params;
    setRequestLocale(lang);

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect(`/${lang}/login`);

    // RLS client: the select policy already hides other people's drafts; the
    // explicit owner check on top keeps published-but-foreign games out of
    // the editor (they are readable, not editable).
    const { data } = await supabase
        .from("eca_games")
        .select("id, owner_id, name, description, status, definition")
        .eq("id", id)
        .maybeSingle();
    if (!data || data.owner_id !== user.id) redirect(`/${lang}/studio`);

    // Rows are validated by the API before every write, so this only fails on
    // hand-tampered data — in which case the editor has nothing to edit.
    const validated = validateEcaDefinition(data.definition);
    if (!validated.ok) redirect(`/${lang}/studio`);

    return (
        <div className="min-h-screen px-4 pt-8 pb-16 md:pt-12 xl:px-10">
            <div className="mx-auto flex max-w-lg flex-col gap-8 lg:max-w-5xl xl:max-w-7xl">
                <EcaEditor
                    initialGame={{
                        id: data.id,
                        name: data.name,
                        description: data.description,
                        status: data.status,
                        definition: validated.definition,
                    }}
                />
            </div>
        </div>
    );
}
