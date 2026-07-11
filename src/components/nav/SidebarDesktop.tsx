"use client";

import { Link } from "@/i18n/navigation";
import { Brand } from "./Brand";
import { NavActions } from "./NavActions";
import { NavAvatar } from "./NavAvatar";
import { NavLinks } from "./NavLinks";

type Props = {
    profile: { username: string | null; avatar_url: string | null } | null;
    avatarUrl: string | null;
    level: number;
    initial: string;
    coins: string;
    levelShort: string;
    canModerate: boolean;
};

export function SidebarDesktop({
    profile,
    avatarUrl,
    level,
    initial,
    coins,
    levelShort,
    canModerate,
}: Props) {
    return (
        <aside
            className="fixed top-0 left-0 z-40 hidden h-screen w-59 flex-col gap-1.5 px-4 py-5 md:flex"
            style={{
                background: "var(--panel-d2)",
                borderRight: "3px solid var(--ink)",
            }}
        >
            <div className="px-1.5 pt-1 pb-3.5">
                <Brand size="md" />
            </div>

            <div className="flex-1 overflow-y-auto">
                <NavLinks variant="sidebar" canModerate={canModerate} />
            </div>

            <div className="mt-auto flex flex-col gap-3">
                <div className="flex gap-2">
                    <span
                        className="inline-flex items-center gap-1.5 rounded-full border-nb px-3 py-1 font-display text-sm"
                        style={{
                            background: "var(--cream)",
                            borderColor: "var(--ink)",
                            color: "var(--ink)",
                            boxShadow: "0 3px 0 var(--ink)",
                        }}
                    >
                        <span style={{ color: "var(--gold)" }}>◆</span>0
                        <span
                            className="font-body text-wc-tag font-semibold"
                            style={{ color: "#7a7052" }}
                        >
                            {coins}
                        </span>
                    </span>
                </div>

                <NavActions variant="sidebar" shown={true} />

                <Link href="/profile" className="wc-me">
                    <NavAvatar
                        avatarUrl={avatarUrl}
                        initial={initial}
                        username={profile?.username ?? null}
                        sizePx={42}
                        initialClassName="text-lg"
                    />
                    <div className="min-w-0">
                        <p
                            className="truncate font-display text-lg leading-none"
                            style={{ color: "var(--cream)" }}
                        >
                            {profile?.username ?? "—"}
                        </p>
                        <p
                            className="mt-1 font-pixel text-wc-micro uppercase"
                            style={{
                                color: "var(--muted)",
                                fontFamily: "var(--pixel)",
                            }}
                        >
                            {levelShort} {level}
                        </p>
                    </div>
                </Link>
            </div>
        </aside>
    );
}
