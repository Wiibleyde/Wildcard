import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import { NavActions } from "./NavActions";
import { NavLinks } from "./NavLinks";
import { SidebarDesktop } from "./SidebarDesktop";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type PlayerXP = Database["public"]["Tables"]["player_xp"]["Row"];

function xpLevel(xp: number) {
    return Math.floor(xp / 500) + 1;
}

export async function AppNav() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const [profileRes, xpRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        supabase.from("player_xp").select("xp").eq("user_id", user.id).single(),
    ]);

    const t = await getTranslations("navigation");
    const tProfile = await getTranslations("profile");

    const profile = profileRes.data as Profile | null;
    const xpRow = xpRes.data as Pick<PlayerXP, "xp"> | null;
    const xp = xpRow?.xp ?? 0;
    const level = xpLevel(xp);

    const avatarUrl = profile?.avatar_url
        ? supabase.storage.from("avatars").getPublicUrl(profile.avatar_url).data
              .publicUrl
        : null;

    const initial = profile?.username?.[0]?.toUpperCase() ?? "?";

    return (
        <>
            {/* ── Desktop sidebar ──────────────────────────────────────────────── */}
            <SidebarDesktop
                profile={profile}
                avatarUrl={avatarUrl}
                level={level}
                initial={initial}
                coins={t("coins")}
                levelShort={tProfile("level_short")}
            />

            {/* ── Mobile top bar ───────────────────────────────────────────────── */}
            <header
                className="md:hidden flex items-center justify-between px-4 h-14 sticky top-0 z-40"
                style={{
                    background: "#0c1018",
                    borderBottom: "1px solid #1c2230",
                }}
            >
                <Link href="/" className="flex items-center gap-2">
                    <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0"
                        style={{
                            background:
                                "linear-gradient(135deg, #e8c468, #c49b32)",
                            color: "#15110a",
                        }}
                    >
                        W
                    </div>
                    <span className="text-wc-text font-extrabold text-sm tracking-tight">
                        Wildcard
                    </span>
                </Link>

                <div className="flex items-center gap-1">
                    <NavActions variant="mobile-header" />
                    <Link
                        href="/profile"
                        className="relative w-8 h-8 rounded-full overflow-hidden"
                    >
                        {avatarUrl ? (
                            <Image
                                src={avatarUrl}
                                alt={profile?.username ?? ""}
                                fill
                                sizes="32px"
                                className="object-cover"
                                loading="eager"
                            />
                        ) : (
                            <div
                                className="w-full h-full flex items-center justify-center text-xs font-black"
                                style={{
                                    background:
                                        "linear-gradient(135deg, #e8c468, #c49b32)",
                                    color: "#15110a",
                                }}
                            >
                                {initial}
                            </div>
                        )}
                    </Link>
                </div>
            </header>

            {/* ── Mobile bottom nav ────────────────────────────────────────────── */}
            <nav
                className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center"
                style={{
                    background: "#0c1018",
                    borderTop: "1px solid #1c2230",
                    height: "60px",
                }}
            >
                <NavLinks variant="bottom" />
            </nav>
        </>
    );
}
