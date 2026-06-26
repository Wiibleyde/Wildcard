import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { DecoSuit } from "@/components/brand/DecoSuit";
import { AvatarHero } from "@/components/profile/AvatarHero";
import { LinkedAccounts } from "@/components/profile/LinkedAccounts";
import {
    type EloRatingRow,
    ProfileEloCard,
} from "@/components/profile/ProfileEloCard";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { ProfileXPCard } from "@/components/profile/ProfileXPCard";
import { Link } from "@/i18n/navigation";
import { getGameModule } from "@/lib/games";
import { createClient } from "@/lib/supabase/server";
import { publicStorageUrl } from "@/lib/supabase/storage";
import type { Database } from "@/lib/supabase/types";
import { levelForXp } from "@/lib/xp/xp";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type PlayerXP = Database["public"]["Tables"]["player_xp"]["Row"];

export async function ProfilePage({ lang }: { lang: string }) {
    const t = await getTranslations("profile");

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect(`/${lang}/login`);

    const [profileRes, xpRes, eloRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        supabase.from("player_xp").select("*").eq("user_id", user.id).single(),
        supabase
            .from("player_elo")
            .select("module_id, rating, games_played, wins")
            .eq("user_id", user.id)
            .order("rating", { ascending: false }),
    ]);

    const profile = profileRes.data as Profile | null;
    const playerXP = xpRes.data as PlayerXP | null;
    const xp = playerXP?.xp ?? 0;
    const level = levelForXp(xp);

    const ratings: EloRatingRow[] = (eloRes.data ?? []).map((row) => ({
        moduleId: row.module_id,
        moduleName: getGameModule(row.module_id)?.name ?? row.module_id,
        rating: row.rating,
        gamesPlayed: row.games_played,
        wins: row.wins,
    }));

    const linkedProviders = (user.identities ?? []).map((i) => i.provider);

    const memberSince = new Date(user.created_at).toLocaleDateString(
        lang === "fr" ? "fr-FR" : "en-US",
        { year: "numeric", month: "long" },
    );

    const avatarUrl = profile?.avatar_url
        ? publicStorageUrl("avatars", profile.avatar_url)
        : null;

    return (
        <div
            className="min-h-screen px-4 xl:px-10 pt-6 md:pt-10 pb-16"
            style={{ background: "#0d0a05" }}
        >
            <div className="max-w-lg lg:max-w-4xl xl:max-w-6xl mx-auto flex flex-col gap-5">
                <div
                    className="relative rounded-2xl overflow-hidden"
                    style={{
                        background:
                            "linear-gradient(150deg, #231808 0%, #0d0a05 65%)",
                        border: "2px solid rgba(245,197,22,0.2)",
                        boxShadow: "0 8px 40px rgba(0,0,0,0.4)",
                    }}
                >
                    <DecoSuit
                        suit="♠"
                        style={{
                            fontSize: "18rem",
                            opacity: 0.03,
                            color: "#f5c516",
                            top: "-3rem",
                            right: "-2rem",
                            transform: "rotate(8deg)",
                        }}
                    />

                    <div className="relative z-10 p-6 xl:p-8">
                        <div className="flex items-start justify-between mb-6">
                            <span
                                className="text-xs font-bold uppercase tracking-widest"
                                style={{ color: "#7a6a50" }}
                            >
                                {t("title")}
                            </span>
                            <SignOutButton />
                        </div>

                        <div className="flex items-center gap-5 xl:gap-6">
                            {profile && (
                                <AvatarHero
                                    profile={profile}
                                    avatarUrl={avatarUrl}
                                />
                            )}
                            <div className="flex-1 min-w-0">
                                <h1
                                    className="text-3xl xl:text-4xl font-black truncate leading-tight tracking-tight"
                                    style={{ color: "#faf2e2" }}
                                >
                                    {profile?.username ?? "—"}
                                </h1>
                                <div className="flex flex-wrap items-center gap-2 mt-2">
                                    <span
                                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-black uppercase tracking-wider"
                                        style={{
                                            background: "rgba(245,197,22,0.12)",
                                            color: "#f5c516",
                                            border: "2px solid rgba(245,197,22,0.3)",
                                        }}
                                    >
                                        ♟ {t("level_short")} {level}
                                    </span>
                                    <span
                                        className="text-xs font-semibold"
                                        style={{ color: "#7a6a50" }}
                                    >
                                        {t("member_since")} {memberSince}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="mt-5">
                            <ProfileXPCard xp={xp} />
                        </div>
                    </div>
                </div>

                <div className="lg:grid lg:grid-cols-2 lg:gap-5 flex flex-col gap-5 lg:flex-none">
                    <div
                        className="rounded-xl p-6 border"
                        style={{
                            background: "#1c1510",
                            borderColor: "#3d2d18",
                        }}
                    >
                        <h2
                            className="text-xs font-bold uppercase tracking-widest mb-5"
                            style={{ color: "#7a6a50" }}
                        >
                            {t("edit_title")}
                        </h2>
                        {profile && (
                            <ProfileForm
                                userId={user.id}
                                initialUsername={profile.username}
                                initialAvatarPath={profile.avatar_url ?? null}
                            />
                        )}
                    </div>

                    <div
                        className="rounded-xl p-6 border"
                        style={{
                            background: "#1c1510",
                            borderColor: "#3d2d18",
                        }}
                    >
                        <h2
                            className="text-xs font-bold uppercase tracking-widest mb-5"
                            style={{ color: "#7a6a50" }}
                        >
                            {t("linked_accounts")}
                        </h2>
                        <LinkedAccounts linkedProviders={linkedProviders} />
                    </div>
                </div>

                <ProfileEloCard ratings={ratings} />

                <Link
                    href="/profile/history"
                    className="group rounded-xl p-6 border flex items-center justify-between gap-4 transition-colors"
                    style={{ background: "#1c1510", borderColor: "#3d2d18" }}
                >
                    <div className="min-w-0">
                        <h2
                            className="text-xs font-bold uppercase tracking-widest mb-1"
                            style={{ color: "#7a6a50" }}
                        >
                            {t("history")}
                        </h2>
                        <p
                            className="text-sm font-semibold"
                            style={{ color: "#9a8870" }}
                        >
                            {t("history_desc")}
                        </p>
                    </div>
                    <span
                        className="text-2xl font-black shrink-0 transition-transform group-hover:translate-x-1"
                        style={{ color: "#f5c516" }}
                        aria-hidden="true"
                    >
                        →
                    </span>
                </Link>
            </div>
        </div>
    );
}
