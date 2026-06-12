import { redirect } from "next/navigation";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LobbyBrowser, type OpenRoom } from "@/components/lobby/LobbyBrowser";
import { GAMES, gameCatalog } from "@/lib/games";
import { createClient } from "@/lib/supabase/server";

export default async function Page({
    params,
}: {
    params: Promise<{ lang: Locale }>;
}) {
    const { lang } = await params;
    setRequestLocale(lang);
    const t = await getTranslations("lobby");

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect(`/${lang}/login`);

    const catalog = gameCatalog();

    const { data: rooms } = await supabase
        .from("rooms")
        .select("id, code, module_id")
        .eq("status", "lobby")
        .order("created_at", { ascending: false })
        .limit(24);
    const roomRows = rooms ?? [];

    const { data: seats } = roomRows.length
        ? await supabase
              .from("room_players")
              .select("room_id")
              .in(
                  "room_id",
                  roomRows.map((r) => r.id),
              )
        : { data: [] };
    const countByRoom = new Map<string, number>();
    for (const s of seats ?? []) {
        countByRoom.set(s.room_id, (countByRoom.get(s.room_id) ?? 0) + 1);
    }

    const openRooms: OpenRoom[] = roomRows.map((r) => {
        const module = GAMES[r.module_id];
        return {
            code: r.code,
            moduleId: r.module_id,
            moduleName: module?.name ?? r.module_id,
            count: countByRoom.get(r.id) ?? 0,
            max: module?.maxPlayers ?? 0,
        };
    });

    return (
        <div
            className="min-h-screen px-4 xl:px-10 pt-8 md:pt-12 pb-16"
            style={{ background: "#0d0a05" }}
        >
            <div className="max-w-lg lg:max-w-5xl xl:max-w-7xl mx-auto flex flex-col gap-8">
                <header className="flex flex-col gap-1">
                    <h1
                        className="text-3xl xl:text-4xl font-black"
                        style={{ color: "#faf2e2" }}
                    >
                        {t("title")}
                    </h1>
                    <p
                        className="text-sm font-semibold"
                        style={{ color: "#9a8870" }}
                    >
                        {t("subtitle")}
                    </p>
                </header>
                <LobbyBrowser catalog={catalog} openRooms={openRooms} />
            </div>
        </div>
    );
}
