import { redirect } from "next/navigation";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
    RoomClient,
    type SeatRow,
    type SpectatorRow,
} from "@/components/lobby/RoomClient";
import { GAMES } from "@/lib/games";
import { usernamesByIds } from "@/lib/models/usernames";
import { createClient } from "@/lib/supabase/server";

export default async function Page({
    params,
}: {
    params: Promise<{ lang: Locale; code: string }>;
}) {
    const { lang, code } = await params;
    setRequestLocale(lang);
    const t = await getTranslations("room");

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect(`/${lang}/login`);

    const normalized = code.toUpperCase();
    const { data: room } = await supabase
        .from("rooms")
        .select(
            "id, code, module_id, host_id, status, current_game_id, bot_count",
        )
        .eq("code", normalized)
        .maybeSingle();

    if (!room) redirect(`/${lang}/lobby`);
    if (room.status === "playing" && room.current_game_id) {
        redirect(`/${lang}/game/${room.current_game_id}`);
    }
    if (room.status === "finished") redirect(`/${lang}/lobby`);

    const module = GAMES[room.module_id];

    const { data: memberRows } = await supabase
        .from("room_players")
        .select("user_id, seat, role")
        .eq("room_id", room.id)
        .order("seat", { ascending: true });
    const rows = memberRows ?? [];

    const nameOf = await usernamesByIds(
        supabase,
        rows.map((r) => r.user_id),
    );

    const initialSeats: SeatRow[] = rows
        .filter((r) => r.role === "player" && r.seat !== null)
        .map((r) => ({
            userId: r.user_id,
            seat: r.seat as number,
            username: nameOf.get(r.user_id) ?? "Joueur",
        }));
    const initialSpectators: SpectatorRow[] = rows
        .filter((r) => r.role === "spectator")
        .map((r) => ({
            userId: r.user_id,
            username: nameOf.get(r.user_id) ?? "Joueur",
        }));
    const me = rows.find((r) => r.user_id === user.id);
    const seated = me !== undefined;
    const initialRole: "player" | "spectator" =
        me?.role === "spectator" ? "spectator" : "player";

    return (
        <div
            className="min-h-screen px-4 xl:px-10 pt-8 md:pt-12 pb-16"
            style={{ background: "#0d0a05" }}
        >
            <div className="max-w-lg lg:max-w-2xl xl:max-w-3xl mx-auto flex flex-col gap-6">
                <h1
                    className="text-2xl xl:text-3xl font-black"
                    style={{ color: "#faf2e2" }}
                >
                    {t("title")}
                </h1>
                <RoomClient
                    roomId={room.id}
                    code={room.code}
                    moduleName={module?.name ?? room.module_id}
                    minPlayers={module?.minPlayers ?? 2}
                    maxPlayers={module?.maxPlayers ?? 8}
                    currentUserId={user.id}
                    initialSeats={initialSeats}
                    initialSpectators={initialSpectators}
                    initialHostId={room.host_id}
                    initialBotCount={room.bot_count}
                    seated={seated}
                    initialRole={initialRole}
                />
            </div>
        </div>
    );
}
