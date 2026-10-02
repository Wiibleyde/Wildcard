import { getTranslations } from "next-intl/server";
import { Avatar } from "@/components/ui/Avatar";
import { Link } from "@/i18n/navigation";
import { getUserRole, roleAtLeast } from "@/lib/auth/roles";
import type { AuthUser } from "@/lib/auth/session";
import { identityOf, nameTag, portalAvatarUrl } from "@/lib/models/identities";
import { createClient } from "@/lib/supabase/server";
import { levelForXp } from "@/lib/xp/xp";
import { Brand } from "./Brand";
import { NavActions } from "./NavActions";
import { NavLinks } from "./NavLinks";
import { SidebarDesktop } from "./SidebarDesktop";

export async function AppNav({ user }: { user: AuthUser }) {
    const supabase = await createClient();

    const [identity, xpRes, role, tProfile, tCommon] = await Promise.all([
        identityOf(supabase, user.id),
        supabase.from("player_xp").select("xp").eq("user_id", user.id).single(),
        getUserRole(supabase, user.id),
        getTranslations("profile"),
        getTranslations("common"),
    ]);
    const canModerate = roleAtLeast(role, "moderator");
    const level = levelForXp(xpRes.data?.xp ?? 0);
    const avatarUrl = portalAvatarUrl(identity.avatarPath);
    const username =
        identity.name ?? tCommon("player_fallback", { tag: nameTag(user.id) });

    return (
        <>
            <SidebarDesktop
                username={username}
                avatarUrl={avatarUrl}
                level={level}
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
                            <Avatar
                                name={username}
                                avatarUrl={avatarUrl}
                                size={32}
                            />
                        </Link>

                        <span className="rounded-md border-2 border-wc-ink bg-wc-cream px-2 py-1 font-pixel text-wc-micro text-wc-ink uppercase">
                            {tProfile("level", { level })}
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
