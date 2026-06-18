import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getUserRole, roleAtLeast } from "@/lib/auth/roles";
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

    const [profileRes, xpRes, role] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        supabase.from("player_xp").select("xp").eq("user_id", user.id).single(),
        getUserRole(supabase, user.id),
    ]);
    const canModerate = roleAtLeast(role, "moderator");

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
            {/* ── Desktop sidebar ──────────────────────────────────────────── */}
            <SidebarDesktop
                profile={profile}
                avatarUrl={avatarUrl}
                level={level}
                initial={initial}
                coins={t("coins")}
                levelShort={tProfile("level_short")}
                canModerate={canModerate}
            />

            {/* ── Mobile top bar ───────────────────────────────────────────── */}
            <header
                className="md:hidden sticky top-0 z-40"
                style={{
                    background: "#0f0b07",
                    borderBottom: "2px solid #3d2d18",
                }}
            >
                <div className="flex items-center justify-between px-4 h-14">
                    <Link href="/" className="flex items-center gap-2.5">
                        <div
                            className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-black shrink-0"
                            style={{
                                background:
                                    "linear-gradient(135deg, #f5c516, #c49010)",
                                color: "#0d0a05",
                                boxShadow: "0 0 12px rgba(245,197,22,0.25)",
                            }}
                        >
                            W
                        </div>
                        <div>
                            <p
                                className="font-black text-sm leading-none tracking-tight"
                                style={{ color: "#faf2e2" }}
                            >
                                Wildcard
                            </p>
                            <p
                                className="text-[9px] font-bold tracking-[0.2em] uppercase"
                                style={{ color: "#7a6a50" }}
                            >
                                ♠ ♥ ♦ ♣
                            </p>
                        </div>
                    </Link>

                    <div className="flex items-center gap-2">
                        <NavActions variant="mobile-header" />

                        {/* Avatar */}
                        <Link href="/profile">
                            <div
                                className="relative w-8 h-8 rounded-full p-[2px] shrink-0"
                                style={{
                                    background:
                                        "linear-gradient(135deg, #f5c516, #e04040)",
                                }}
                            >
                                <div className="relative w-full h-full rounded-full overflow-hidden">
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
                                                    "linear-gradient(135deg, #f5c516, #c49010)",
                                                color: "#0d0a05",
                                            }}
                                        >
                                            {initial}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </Link>

                        {/* Level badge */}
                        <span
                            className="text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-wider"
                            style={{
                                background: "rgba(167,139,250,0.15)",
                                color: "#a78bfa",
                                border: "1px solid rgba(167,139,250,0.25)",
                            }}
                        >
                            {tProfile("level_short")} {level}
                        </span>
                    </div>
                </div>
            </header>

            {/* ── Mobile bottom nav ────────────────────────────────────────── */}
            <nav
                className="md:hidden fixed bottom-0 left-0 right-0 z-40"
                style={{
                    background: "#0f0b07",
                    borderTop: "2px solid #3d2d18",
                    height: "68px",
                    boxShadow: "0 -4px 20px rgba(0,0,0,0.4)",
                }}
            >
                <NavLinks variant="bottom" canModerate={canModerate} />
            </nav>
        </>
    );
}
