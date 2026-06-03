import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { AvatarHero } from "@/components/profile/AvatarHero";
import { LinkedAccounts } from "@/components/profile/LinkedAccounts";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { ProfileXPCard } from "@/components/profile/ProfileXPCard";
import { getDictionary } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type PlayerXP = Database["public"]["Tables"]["player_xp"]["Row"];

export async function ProfilePage({ lang }: { lang: string }) {
    const dict = await getDictionary(lang);

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect(`/${lang}/login`);

    const [profileRes, xpRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        supabase.from("player_xp").select("*").eq("user_id", user.id).single(),
    ]);

    const profile = profileRes.data as Profile | null;
    const playerXP = xpRes.data as PlayerXP | null;
    const xp = playerXP?.xp ?? 0;
    const level = Math.floor(xp / 500) + 1;

    const linkedProviders = (user.identities ?? []).map((i) => i.provider);

    const memberSince = new Date(user.created_at).toLocaleDateString(
        lang === "fr" ? "fr-FR" : "en-US",
        { year: "numeric", month: "long" },
    );

    const avatarUrl = profile?.avatar_url
        ? supabase.storage.from("avatars").getPublicUrl(profile.avatar_url).data
              .publicUrl
        : null;

    return (
        <div className="min-h-screen bg-wc-surface px-4 xl:px-10 pt-6 md:pt-10 pb-10">
            <div className="max-w-lg lg:max-w-4xl xl:max-w-6xl mx-auto flex flex-col gap-4">
                <div className="lg:grid lg:grid-cols-2 lg:gap-6 lg:items-start">
                    <div className="flex flex-col gap-4">
                        <div
                            className="rounded-wc-card p-6 border"
                            style={{
                                background:
                                    "linear-gradient(160deg, #1d1a0e, #0c1118 72%)",
                                borderColor: "rgba(232,196,104,0.22)",
                            }}
                        >
                            <div className="flex items-center justify-between mb-5">
                                <span className="text-(length:--font-size-wc-label) font-bold text-wc-sub uppercase tracking-(--letter-spacing-wc-cap)">
                                    {dict.profile.title}
                                </span>
                                <SignOutButton label={dict.profile.sign_out} />
                            </div>

                            <div className="flex items-center gap-4">
                                {profile && (
                                    <AvatarHero
                                        profile={profile}
                                        avatarUrl={avatarUrl}
                                    />
                                )}
                                <div className="flex-1 min-w-0">
                                    <h1 className="text-2xl font-extrabold text-wc-text truncate leading-tight tracking-tight">
                                        {profile?.username ?? "—"}
                                    </h1>
                                    <div className="flex items-center gap-2 mt-1.5">
                                        <span
                                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
                                            style={{
                                                background:
                                                    "rgba(232,196,104,0.16)",
                                                color: "#e8c468",
                                                border: "1px solid rgba(232,196,104,0.35)",
                                            }}
                                        >
                                            {dict.profile.level_short} {level}
                                        </span>
                                        <span className="text-wc-sub text-xs font-medium">
                                            {dict.profile.member_since}{" "}
                                            {memberSince}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <ProfileXPCard xp={xp} dict={dict} />
                    </div>

                    <div className="flex flex-col gap-4">
                        <div className="bg-wc-panel rounded-wc-panel p-6 border border-wc-border">
                            <h2 className="text-sm font-bold text-wc-muted mb-5 uppercase tracking-(--letter-spacing-wc-cap)">
                                {dict.profile.edit_title}
                            </h2>
                            {profile && (
                                <ProfileForm
                                    userId={user.id}
                                    initialUsername={profile.username}
                                    initialAvatarPath={
                                        profile.avatar_url ?? null
                                    }
                                    dict={dict}
                                />
                            )}
                        </div>

                        <div className="bg-wc-panel rounded-wc-panel p-6 border border-wc-border">
                            <h2 className="text-sm font-bold text-wc-muted mb-5 uppercase tracking-(--letter-spacing-wc-cap)">
                                {dict.profile.linked_accounts}
                            </h2>
                            <LinkedAccounts
                                linkedProviders={linkedProviders}
                                dict={dict}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
