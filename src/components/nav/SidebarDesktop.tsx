"use client";

import Image from "next/image";
import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { NavActions } from "./NavActions";
import { useNavCollapse } from "./NavCollapseContext";
import { NavLinks } from "./NavLinks";

function ChevronLeftIcon() {
    return (
        <svg
            viewBox="0 0 24 24"
            className="w-3 h-3"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M15 18l-6-6 6-6" />
        </svg>
    );
}

function ChevronRightIcon() {
    return (
        <svg
            viewBox="0 0 24 24"
            className="w-3 h-3"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M9 18l6-6-6-6" />
        </svg>
    );
}

function CoinIcon() {
    return (
        <svg
            viewBox="0 0 24 24"
            className="w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v10M9 9.5a3 1.5 0 0 1 3-1.5M9 14.5a3 1.5 0 0 0 3 1.5" />
        </svg>
    );
}

type Props = {
    profile: { username: string | null; avatar_url: string | null } | null;
    avatarUrl: string | null;
    level: number;
    initial: string;
    coins: string;
    levelShort: string;
};

export function SidebarDesktop({
    profile,
    avatarUrl,
    level,
    initial,
    coins,
    levelShort,
}: Props) {
    const { collapsed, toggle } = useNavCollapse();
    const [hovering, setHovering] = useState(false);
    const shown = !collapsed || hovering;

    return (
        <aside
            className={`hidden md:flex flex-col fixed top-0 left-0 h-screen z-40 transition-all duration-200 ${
                shown ? "w-55 xl:w-64 px-3.5 pt-5 pb-4" : "w-14 px-0 py-5"
            }`}
            style={{
                background: "#0c1018",
                borderRight: "1px solid #1c2230",
                boxShadow:
                    hovering && collapsed
                        ? "4px 0 24px rgba(0,0,0,0.4)"
                        : undefined,
            }}
            onMouseEnter={() => collapsed && setHovering(true)}
            onMouseLeave={() => setHovering(false)}
        >
            {/* collapse toggle */}
            <button
                type="button"
                onClick={toggle}
                className="absolute -right-3 top-6 w-6 h-6 rounded-full flex items-center justify-center z-50 transition-colors"
                style={{
                    background: "#0c1018",
                    border: "1px solid #1c2230",
                    color: "#7c8699",
                }}
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
                {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
            </button>

            {/* logo */}
            <Link
                href="/"
                className={`flex items-center gap-2.5 mb-1 shrink-0 ${
                    shown ? "px-1" : "justify-center"
                }`}
            >
                <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black shrink-0"
                    style={{
                        background: "linear-gradient(135deg, #e8c468, #c49b32)",
                        color: "#15110a",
                    }}
                >
                    W
                </div>
                {shown && (
                    <span className="text-wc-text font-extrabold text-base tracking-tight">
                        Wildcard
                    </span>
                )}
            </Link>

            <NavLinks variant="sidebar" shown={shown} />

            {/* bottom */}
            <div className="mt-auto flex flex-col gap-3">
                {shown && (
                    <div
                        className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold"
                        style={{
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid rgba(255,255,255,0.07)",
                        }}
                    >
                        <CoinIcon />
                        <span style={{ color: "#e8c468" }}>0</span>
                        <span className="text-wc-sub ml-1">{coins}</span>
                    </div>
                )}

                <NavActions variant="sidebar" shown={shown} />

                <Link
                    href="/profile"
                    className={`flex items-center rounded-xl transition-colors hover:bg-white/5 ${
                        shown ? "gap-3 px-3 py-2.5" : "justify-center py-2"
                    }`}
                    title={
                        !shown ? (profile?.username ?? undefined) : undefined
                    }
                >
                    <div className="relative w-9 h-9 rounded-full overflow-hidden shrink-0">
                        {avatarUrl ? (
                            <Image
                                src={avatarUrl}
                                alt={profile?.username ?? ""}
                                fill
                                sizes="36px"
                                className="object-cover"
                                loading="eager"
                            />
                        ) : (
                            <div
                                className="w-full h-full flex items-center justify-center text-sm font-black"
                                style={{
                                    background:
                                        "linear-gradient(135deg, #e8c468, #c49b32)",
                                    color: "#15110a",
                                }}
                            >
                                {initial}
                            </div>
                        )}
                    </div>
                    {shown && (
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-wc-heading truncate leading-none">
                                {profile?.username ?? "—"}
                            </p>
                            <p className="text-xs text-wc-sub font-semibold mt-0.5">
                                {levelShort} {level}
                            </p>
                        </div>
                    )}
                </Link>
            </div>
        </aside>
    );
}
