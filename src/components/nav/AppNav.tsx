import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getUserRole, roleAtLeast } from "@/lib/auth/roles";
import type { AuthUser } from "@/lib/auth/session";
import { identityOf, PORTAL_AVATAR_BUCKET } from "@/lib/models/identities";
import { createClient } from "@/lib/supabase/server";
import { publicStorageUrl } from "@/lib/supabase/storage";
import type { Database } from "@/lib/supabase/types";
import { levelForXp } from "@/lib/xp/xp";
import { Brand } from "./Brand";
import { NavActions } from "./NavActions";
import { NavAvatar } from "./NavAvatar";
import { NavLinks } from "./NavLinks";
import { SidebarDesktop } from "./SidebarDesktop";

type PlayerXP = Database["wildcard"]["Tables"]["player_xp"]["Row"];

export async function AppNav({ user }: { user: AuthUser }) {
    const supabase = await createClient();

    const [identity, xpRes, role] = await Promise.all([
        identityOf(supabase, user.id),
        supabase.from("player_xp").select("xp").eq("user_id", user.id).single(),
        getUserRole(supabase, user.id),
    ]);
    const canModerate = roleAtLeast(role, "moderator");

    const t = await getTranslations("navigation");
    const tProfile = await getTranslations("profile");

    const xpRow = xpRes.data as Pick<PlayerXP, "xp"> | null;
    const xp = xpRow?.xp ?? 0;
    const level = levelForXp(xp);

    const avatarUrl = identity.avatarPath
        ? publicStorageUrl(PORTAL_AVATAR_BUCKET, identity.avatarPath)
        : null;

    const initial = identity.name[0]?.toUpperCase() ?? "?";
    const profile = {
        username: identity.name,
        avatar_url: identity.avatarPath,
    };

    return (
        <>
            <SidebarDesktop
                profile={profile}
                avatarUrl={avatarUrl}
                level={level}
                initial={initial}
                coins={t("coins")}
                levelShort={tProfile("level_short")}
                canModerate={canModerate}
            />

            <header
                className="sticky top-0 z-40 md:hidden"
                style={{
                    background: "var(--panel-d2)",
                    borderBottom: "3px solid var(--ink)",
                }}
            >
                <div className="flex h-14 items-center justify-between px-4">
                    <Brand size="sm" />

                    <div className="flex items-center gap-2">
                        <NavActions variant="mobile-header" />

                        <Link href="/profile">
                            <NavAvatar
                                avatarUrl={avatarUrl}
                                initial={initial}
                                username={identity.name}
                                sizePx={32}
                                initialClassName="text-xs"
                            />
                        </Link>

                        <span
                            className="rounded-md border-2 px-2 py-1 uppercase"
                            style={{
                                fontFamily: "var(--pixel)",
                                fontSize: "9px",
                                background: "var(--cream)",
                                color: "var(--ink)",
                                borderColor: "var(--ink)",
                            }}
                        >
                            {tProfile("level_short")} {level}
                        </span>
                    </div>
                </div>
            </header>

            <nav
                className="fixed right-0 bottom-0 left-0 z-40 flex md:hidden"
                style={{
                    background: "var(--panel-d2)",
                    borderTop: "3px solid var(--ink)",
                    padding: "8px 8px calc(8px + env(safe-area-inset-bottom))",
                }}
            >
                <NavLinks variant="bottom" canModerate={canModerate} />
            </nav>
        </>
    );
}
