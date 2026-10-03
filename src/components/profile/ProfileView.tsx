import { useFormatter, useTranslations } from "next-intl";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { DecoSuit } from "@/components/brand/DecoSuit";
import { Avatar } from "@/components/ui/Avatar";
import { GameButton } from "@/components/ui/GameButton";
import { PageShell } from "@/components/ui/PageShell";
import { Link } from "@/i18n/navigation";
import { levelForXp } from "@/lib/xp/xp";
import { type EloRatingRow, ProfileEloCard } from "./ProfileEloCard";
import { ProfileXPCard } from "./ProfileXPCard";

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
            className="panel-d lift group flex items-center justify-between gap-4 p-6"
        >
            <div className="min-w-0">
                <h2
                    className="stamp mb-2"
                    style={{ background: accent, color: "var(--ink)" }}
                >
                    {title}
                </h2>
                <p className="text-sm font-semibold text-wc-muted">
                    {description}
                </p>
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

    return (
        <PageShell className="grid gap-5 lg:grid-cols-2 lg:items-start">
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
                        <div className="mb-6 flex items-start justify-between">
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
                            <Avatar
                                name={name}
                                avatarUrl={avatarUrl}
                                size={80}
                                shadow
                            />
                            <div className="min-w-0 flex-1">
                                <h1 className="truncate font-display text-3xl leading-tight text-wc-cream xl:text-4xl">
                                    {name}
                                </h1>
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                    <span
                                        className="stamp"
                                        style={{
                                            background: "var(--purple)",
                                            color: "var(--accent-ink)",
                                        }}
                                    >
                                        <span aria-hidden="true">♟</span>
                                        {t("level", { level: levelForXp(xp) })}
                                    </span>
                                    {memberSince && (
                                        <span className="text-xs font-semibold text-wc-muted">
                                            {t("member_since", {
                                                date: format.dateTime(
                                                    memberSince,
                                                    "monthYear",
                                                ),
                                            })}
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

                <div className="panel-d flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
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
                        <p className="text-sm font-semibold text-wc-muted">
                            {manageUrl ? t("account_desc") : t("account_dev")}
                        </p>
                    </div>
                    {manageUrl && (
                        <div className="flex shrink-0 flex-col items-stretch gap-2">
                            <GameButton href={manageUrl} size="sm">
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
                </div>

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

            <div className="min-w-0">
                <ProfileEloCard ratings={ratings} />
            </div>
        </PageShell>
    );
}
