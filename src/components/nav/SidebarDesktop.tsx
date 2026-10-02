"use client";

import { Link } from "@/i18n/navigation";
import { Brand } from "./Brand";
import { NavActions } from "./NavActions";
import { NavAvatar } from "./NavAvatar";
import { NavLinks } from "./NavLinks";

type Props = {
    username: string;
    avatarUrl: string | null;
    level: number;
    initial: string;
    levelShort: string;
    canModerate: boolean;
};

export function SidebarDesktop({
    username,
    avatarUrl,
    level,
    initial,
    levelShort,
    canModerate,
}: Props) {
    return (
        <aside
            className="fixed top-0 left-0 z-40 hidden h-screen w-55 flex-col gap-1.5 px-4 py-5 md:flex xl:w-64"
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
                <NavActions variant="sidebar" />

                <Link href="/profile" className="wc-me">
                    <NavAvatar
                        avatarUrl={avatarUrl}
                        initial={initial}
                        username={username}
                        sizePx={42}
                        initialClassName="text-lg"
                    />
                    <div className="min-w-0">
                        <p
                            className="truncate font-display text-lg leading-none"
                            style={{ color: "var(--cream)" }}
                        >
                            {username}
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
