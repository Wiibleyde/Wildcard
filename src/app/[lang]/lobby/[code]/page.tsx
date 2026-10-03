import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { RoomClient } from "@/components/room/RoomClient";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageShell } from "@/components/ui/PageShell";
import { redirect } from "@/i18n/navigation";
import { requireAuthUser } from "@/lib/auth/session";
import { resolveRuleToggles } from "@/lib/engine/types";
import { resolveGameModule } from "@/lib/games/resolve";
import { type Role, splitRoster } from "@/lib/lobby/roster";
import { nameTag, usernamesByIds } from "@/lib/models/identities";
import { normalizeRoomCode } from "@/lib/models/roomCode";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({
    params,
}: {
    params: Promise<{ lang: Locale }>;
}): Promise<Metadata> {
    const { lang } = await params;
    const t = await getTranslations({ locale: lang, namespace: "room" });
    return { title: t("title") };
}

export default async function Page({
    params,
}: {
    params: Promise<{ lang: Locale; code: string }>;
}) {
    const { lang, code } = await params;
    setRequestLocale(lang);
    const t = await getTranslations("room");
    const tCommon = await getTranslations("common");

    const user = await requireAuthUser(lang, `/${lang}/lobby/${code}`);
    const supabase = await createClient();

    const { data: room } = await supabase
        .from("rooms")
        .select(
            "id, code, module_id, host_id, status, current_game_id, bot_count, rules",
        )
        .eq("code", normalizeRoomCode(code))
        .maybeSingle();

    if (!room || room.status === "finished") {
        return redirect({ href: "/lobby", locale: lang });
    }
    if (room.status === "playing" && room.current_game_id) {
        return redirect({
            href: `/game/${room.current_game_id}`,
            locale: lang,
        });
    }

    // Admin client: an invited member can't read the host's unpublished studio
    // draft under RLS; only its public meta (name, player range) is used here.
    const module = await resolveGameModule(createAdminClient(), room.module_id);
    const maxPlayers = module?.maxPlayers ?? 8;

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
    const { seats, spectators } = splitRoster(rows, nameOf, (id) =>
        tCommon("player_fallback", { tag: nameTag(id) }),
    );

    const me = rows.find((r) => r.user_id === user.id);
    // Mirror joinRoom: a newcomer at a full table is seated as a spectator, so a
    // late arrival never briefly gets the player controls.
    const initialRole: Role = me
        ? me.role === "spectator"
            ? "spectator"
            : "player"
        : seats.length >= maxPlayers
          ? "spectator"
          : "player";

    return (
        <PageShell>
            <PageHeader title={t("title")} />
            <RoomClient
                roomId={room.id}
                code={room.code}
                moduleName={module?.name ?? room.module_id}
                minPlayers={module?.minPlayers ?? 2}
                maxPlayers={maxPlayers}
                currentUserId={user.id}
                initialSeats={seats}
                initialSpectators={spectators}
                initialHostId={room.host_id}
                initialBotCount={room.bot_count}
                isMember={me !== undefined}
                initialRole={initialRole}
                ruleToggles={module?.ruleToggles ?? []}
                ruleModes={module?.ruleModes ?? []}
                initialRules={resolveRuleToggles(
                    module?.ruleToggles,
                    room.rules,
                )}
            />
        </PageShell>
    );
}
