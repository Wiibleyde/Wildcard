import { getTranslations } from "next-intl/server";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { DecoSuit } from "@/components/brand/DecoSuit";
import { AvatarHero } from "@/components/profile/AvatarHero";
import {
    type EloRatingRow,
    ProfileEloCard,
} from "@/components/profile/ProfileEloCard";
import { ProfileXPCard } from "@/components/profile/ProfileXPCard";
import { Link } from "@/i18n/navigation";
import { requireAuthUser } from "@/lib/auth/session";
import { accountUrl, forgotPasswordUrl } from "@/lib/auth/urls";
import { getGameModule } from "@/lib/games";
import { ecaNamesByModuleIds } from "@/lib/games/resolve";
import { identityOf, portalAvatarUrl } from "@/lib/models/identities";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import { levelForXp } from "@/lib/xp/xp";

type Profile = Database["wildcard"]["Tables"]["profiles"]["Row"];
type PlayerXP = Database["wildcard"]["Tables"]["player_xp"]["Row"];

export async function ProfilePage({ lang }: { lang: string }) {
    const t = await getTranslations("profile");

    const user = await requireAuthUser(lang, `/${lang}/profile`);
    const supabase = await createClient();

    const [identity, profileRes, xpRes, eloRes] = await Promise.all([
        identityOf(supabase, user.id),
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

    const ecaNames = await ecaNamesByModuleIds(
        supabase,
        (eloRes.data ?? []).map((row) => row.module_id),
    );
    const ratings: EloRatingRow[] = (eloRes.data ?? []).map((row) => ({
        moduleId: row.module_id,
        moduleName:
            getGameModule(row.module_id)?.name ??
            ecaNames.get(row.module_id) ??
            row.module_id,
        rating: row.rating,
        gamesPlayed: row.games_played,
        wins: row.wins,
    }));

    // Game profile creation date — when the account first reached Wildcard.
    const memberSince = profile?.created_at
        ? new Date(profile.created_at).toLocaleDateString(
              lang === "fr" ? "fr-FR" : "en-US",
              { year: "numeric", month: "long" },
          )
        : null;

    const avatarUrl = portalAvatarUrl(identity.avatarPath);
    // Pseudo, profile picture, friends and linked accounts belong to the
    // portal account: Wildcard only displays them and links there.
    const manageUrl = accountUrl();
    const forgotUrl = forgotPasswordUrl();

    return (
        <div className="min-h-screen px-4 xl:px-10 pt-6 md:pt-10 pb-16">
            {/* lg+: identity / account / history on the left, ELO table on the right. */}
            <div className="mx-auto grid max-w-lg gap-5 lg:max-w-4xl lg:grid-cols-2 lg:items-start xl:max-w-6xl 2xl:max-w-7xl">
                <div className="flex min-w-0 flex-col gap-5">
                    <div className="panel-d relative overflow-hidden">
                        <DecoSuit
                            suit="♠"
                            style={{
                                fontSize: "18rem",
                                opacity: 0.06,
                                color: "var(--cream)",
                                top: "-3rem",
                                right: "-2rem",
                                transform: "rotate(8deg)",
                            }}
                        />

                        <div className="relative z-10 p-6 xl:p-8">
                            <div className="flex items-start justify-between mb-6">
                                <span
                                    className="stamp"
                                    style={{
                                        background: "var(--gold)",
                                        color: "var(--ink)",
                                    }}
                                >
                                    {t("title")}
                                </span>
                                <SignOutButton />
                            </div>

                            <div className="flex items-center gap-5 xl:gap-6">
                                <AvatarHero
                                    name={identity.name}
                                    avatarUrl={avatarUrl}
                                />
                                <div className="flex-1 min-w-0">
                                    <h1
                                        className="font-display text-3xl xl:text-4xl truncate leading-tight"
                                        style={{ color: "var(--cream)" }}
                                    >
                                        {identity.name}
                                    </h1>
                                    <div className="flex flex-wrap items-center gap-2 mt-2">
                                        <span
                                            className="stamp"
                                            style={{
                                                background: "var(--purple)",
                                                color: "var(--accent-ink)",
                                            }}
                                        >
                                            ♟ {t("level_short")} {level}
                                        </span>
                                        {memberSince && (
                                            <span
                                                className="text-xs font-semibold"
                                                style={{
                                                    color: "var(--muted)",
                                                }}
                                            >
                                                {t("member_since")}{" "}
                                                {memberSince}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="mt-5">
                                <ProfileXPCard xp={xp} />
                            </div>
                        </div>
                    </div>

                    <div className="panel-d p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                            <h2
                                className="stamp mb-2"
                                style={{
                                    background: "var(--blue)",
                                    color: "var(--accent-ink)",
                                }}
                            >
                                {t("account_title")}
                            </h2>
                            <p
                                className="text-sm font-semibold"
                                style={{ color: "var(--muted)" }}
                            >
                                {manageUrl
                                    ? t("account_desc")
                                    : t("account_dev")}
                            </p>
                        </div>
                        {manageUrl && (
                            <div className="flex shrink-0 flex-col items-stretch gap-2">
                                <a
                                    href={manageUrl}
                                    className="wc-btn px-4 py-2 text-sm text-center"
                                    style={{
                                        background: "var(--gold)",
                                        color: "var(--ink)",
                                    }}
                                >
                                    {t("account_manage")}
                                </a>
                                {forgotUrl && (
                                    <a
                                        href={forgotUrl}
                                        className="text-center text-xs font-bold underline"
                                        style={{ color: "var(--muted)" }}
                                    >
                                        {t("account_forgot")}
                                    </a>
                                )}
                            </div>
                        )}
                    </div>

                    <Link
                        href="/profile/friends"
                        className="panel-d lift group p-6 flex items-center justify-between gap-4"
                    >
                        <div className="min-w-0">
                            <h2
                                className="stamp mb-2"
                                style={{
                                    background: "var(--green)",
                                    color: "var(--ink)",
                                }}
                            >
                                {t("friends")}
                            </h2>
                            <p
                                className="text-sm font-semibold"
                                style={{ color: "var(--muted)" }}
                            >
                                {t("friends_desc")}
                            </p>
                        </div>
                        <span
                            className="font-display text-2xl shrink-0 transition-transform group-hover:translate-x-1"
                            style={{ color: "var(--green)" }}
                            aria-hidden="true"
                        >
                            →
                        </span>
                    </Link>

                    <Link
                        href="/profile/history"
                        className="panel-d lift group p-6 flex items-center justify-between gap-4"
                    >
                        <div className="min-w-0">
                            <h2
                                className="stamp mb-2"
                                style={{
                                    background: "var(--gold)",
                                    color: "var(--ink)",
                                }}
                            >
                                {t("history")}
                            </h2>
                            <p
                                className="text-sm font-semibold"
                                style={{ color: "var(--muted)" }}
                            >
                                {t("history_desc")}
                            </p>
                        </div>
                        <span
                            className="font-display text-2xl shrink-0 transition-transform group-hover:translate-x-1"
                            style={{ color: "var(--gold)" }}
                            aria-hidden="true"
                        >
                            →
                        </span>
                    </Link>
                </div>

                <div className="min-w-0">
                    <ProfileEloCard ratings={ratings} />
                </div>
            </div>
        </div>
    );
}
