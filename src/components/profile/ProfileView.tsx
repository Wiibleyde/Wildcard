import { useFormatter, useTranslations } from "next-intl";
import { GameButton } from "@/components/ui/GameButton";
import { PageShell } from "@/components/ui/PageShell";
import { Link } from "@/i18n/navigation";
import { levelForXp } from "@/lib/xp/xp";
import { PlayerCard } from "./PlayerCard";
import { type EloRatingRow, ProfileEloCard } from "./ProfileEloCard";
import { ProfileXPCard } from "./ProfileXPCard";
import { SignOutButton } from "./SignOutButton";

interface Props {
    name: string;
    avatarUrl: string | null;
    xp: number;
    memberSince: Date | null;
    ratings: readonly EloRatingRow[];
    /** Portal account page; `null` in local dev (no portal). */
    manageUrl: string | null;
    forgotUrl: string | null;
}

function LinkCard({
    href,
    title,
    description,
    accent,
}: {
    href: string;
    title: string;
    description: string;
    accent: string;
}) {
    return (
        <Link
            href={href}
            className="panel lift group flex items-center justify-between gap-4 p-5"
        >
            <div className="min-w-0">
                <h2 className="font-display text-xl" style={{ color: accent }}>
                    {title}
                </h2>
                <p className="mt-1 text-sm text-wc-muted">{description}</p>
            </div>
            <span
                aria-hidden="true"
                className="shrink-0 font-display text-2xl transition-transform group-hover:translate-x-1"
                style={{ color: accent }}
            >
                →
            </span>
        </Link>
    );
}

export function ProfileView({
    name,
    avatarUrl,
    xp,
    memberSince,
    ratings,
    manageUrl,
    forgotUrl,
}: Props) {
    const t = useTranslations("profile");
    const format = useFormatter();

    const level = levelForXp(xp);
    const since = memberSince
        ? format.dateTime(memberSince, "monthYear")
        : null;

    return (
        <PageShell className="grid gap-6 lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)] lg:items-start">
            <div className="flex flex-col items-center gap-4 lg:sticky lg:top-6">
                <PlayerCard
                    name={name}
                    avatarUrl={avatarUrl}
                    level={level}
                    memberSince={since}
                />
                <SignOutButton />
            </div>

            <div className="flex min-w-0 flex-col gap-5">
                <section className="panel p-5">
                    <ProfileXPCard xp={xp} />
                </section>

                <ProfileEloCard ratings={ratings} />

                <div className="grid gap-4 md:grid-cols-2">
                    <LinkCard
                        href="/profile/friends"
                        title={t("friends")}
                        description={t("friends_desc")}
                        accent="var(--green)"
                    />
                    <LinkCard
                        href="/profile/history"
                        title={t("history")}
                        description={t("history_desc")}
                        accent="var(--gold)"
                    />
                </div>

                <section className="panel flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                        <h2 className="font-display text-xl text-wc-blue">
                            {t("account_title")}
                        </h2>
                        <p className="mt-1 text-sm text-wc-muted">
                            {manageUrl ? t("account_desc") : t("account_dev")}
                        </p>
                    </div>
                    {manageUrl && (
                        <div className="flex shrink-0 flex-col items-stretch gap-2">
                            <GameButton
                                href={manageUrl}
                                variant="teal"
                                size="sm"
                            >
                                {t("account_manage")}
                            </GameButton>
                            {forgotUrl && (
                                <a
                                    href={forgotUrl}
                                    className="text-center text-xs font-bold text-wc-muted underline"
                                >
                                    {t("account_forgot")}
                                </a>
                            )}
                        </div>
                    )}
                </section>
            </div>
        </PageShell>
    );
}
