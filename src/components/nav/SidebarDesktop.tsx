"use client";

import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { NavActions } from "./NavActions";
import { NavLinks } from "./NavLinks";

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
    return (
        <aside
            className="hidden md:flex flex-col fixed top-0 left-0 h-screen z-40 w-60 xl:w-68"
            style={{
                background: "#0f0b07",
                borderRight: "2px solid #3d2d18",
                boxShadow: "4px 0 20px rgba(0,0,0,0.3)",
            }}
        >
            {/* ── Logo / header section ──────────────────────────────────── */}
            <div
                className="shrink-0 px-4 pt-5 pb-4"
                style={{ borderBottom: "1px solid #2a1e0f" }}
            >
                <div className="flex items-center gap-3">
                    {/* W logo card */}
                    <Link href="/" className="shrink-0 block">
                        <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg"
                            style={{
                                background:
                                    "linear-gradient(135deg, #f5c516, #c49010)",
                                color: "#0d0a05",
                                boxShadow:
                                    "0 0 20px rgba(245,197,22,0.25), 0 3px 0 0 #7a5a00",
                            }}
                        >
                            W
                        </div>
                    </Link>

                    <Link href="/" className="flex-1 min-w-0">
                        <p
                            className="font-black text-base tracking-tight leading-none"
                            style={{ color: "#faf2e2" }}
                        >
                            Wildcard
                        </p>
                        <p
                            className="text-[10px] font-bold tracking-[0.2em] uppercase mt-0.5"
                            style={{ color: "#7a6a50" }}
                        >
                            ♠ ♥ ♦ ♣
                        </p>
                    </Link>
                </div>
            </div>

            {/* ── Nav links ──────────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto px-3 py-3">
                <NavLinks variant="sidebar" shown={true} />
            </div>

            {/* ── Bottom section ─────────────────────────────────────────── */}
            <div
                className="shrink-0 px-3 pb-4 pt-3 flex flex-col gap-2"
                style={{ borderTop: "1px solid #2a1e0f" }}
            >
                {/* Coins widget */}
                <div
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl"
                    style={{
                        background: "rgba(245,197,22,0.06)",
                        border: "1px solid rgba(245,197,22,0.15)",
                    }}
                >
                    <div
                        className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-black"
                        style={{
                            background:
                                "linear-gradient(135deg, #f5c516, #c49010)",
                            color: "#0d0a05",
                        }}
                    >
                        $
                    </div>
                    <span
                        className="font-black text-sm"
                        style={{ color: "#f5c516" }}
                    >
                        0
                    </span>
                    <span
                        className="text-xs font-semibold"
                        style={{ color: "#7a6a50" }}
                    >
                        {coins}
                    </span>
                </div>

                {/* Lang + logout */}
                <NavActions variant="sidebar" shown={true} />

                {/* Profile card */}
                <Link
                    href="/profile"
                    className="flex items-center gap-3 p-2.5 rounded-xl transition-all duration-150"
                    style={{
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid #2a1e0f",
                    }}
                >
                    {/* Avatar with gradient ring */}
                    <div
                        className="relative w-9 h-9 rounded-full shrink-0 p-[2px]"
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
                                    sizes="36px"
                                    className="object-cover"
                                    loading="eager"
                                />
                            ) : (
                                <div
                                    className="w-full h-full flex items-center justify-center text-sm font-black"
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

                    <div className="flex-1 min-w-0">
                        <p
                            className="text-sm font-black truncate leading-none"
                            style={{ color: "#faf2e2" }}
                        >
                            {profile?.username ?? "—"}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1">
                            <span
                                className="text-[10px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider"
                                style={{
                                    background: "rgba(167,139,250,0.15)",
                                    color: "#a78bfa",
                                    border: "1px solid rgba(167,139,250,0.25)",
                                }}
                            >
                                {levelShort} {level}
                            </span>
                        </div>
                    </div>
                </Link>
            </div>
        </aside>
    );
}
