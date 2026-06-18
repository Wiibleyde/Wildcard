"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import {
    HomeIcon,
    PaletteIcon,
    PlayIcon,
    ShieldIcon,
    ShopIcon,
} from "./NavIcons";

type NavItemConfig = {
    href: string;
    label: string;
    icon: React.ReactNode;
    color: string;
    glow: string;
    suit: string;
};

type Props = {
    variant: "sidebar" | "bottom";
    shown?: boolean;
    /** Show the moderator/admin entry (moderators and admins only). */
    canModerate?: boolean;
};

export function NavLinks({
    variant,
    shown = true,
    canModerate = false,
}: Props) {
    const t = useTranslations("navigation");
    const pathname = usePathname();

    const items: NavItemConfig[] = [
        {
            href: "/",
            label: t("home"),
            icon: <HomeIcon />,
            color: "#f5c516",
            glow: "rgba(245,197,22,0.1)",
            suit: "♠",
        },
        {
            href: "/lobby",
            label: t("play"),
            icon: <PlayIcon />,
            color: "#48c97a",
            glow: "rgba(72,201,122,0.1)",
            suit: "♥",
        },
        {
            href: "/shop",
            label: t("shop"),
            icon: <ShopIcon />,
            color: "#a78bfa",
            glow: "rgba(167,139,250,0.1)",
            suit: "♦",
        },
        {
            href: "/customize",
            label: t("style"),
            icon: <PaletteIcon />,
            color: "#e04040",
            glow: "rgba(224,64,64,0.1)",
            suit: "♣",
        },
        ...(canModerate
            ? [
                  {
                      href: "/admin",
                      label: t("admin"),
                      icon: <ShieldIcon />,
                      color: "#5ab0ff",
                      glow: "rgba(90,176,255,0.1)",
                      suit: "♠",
                  },
              ]
            : []),
    ];

    function isActive(href: string) {
        if (href === "/") return pathname === "/";
        return pathname.startsWith(href);
    }

    if (variant === "sidebar") {
        return (
            <nav className="flex flex-col gap-1 mt-4">
                {items.map((item) => {
                    const active = isActive(item.href);
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center rounded-xl transition-all duration-150 ${
                                shown
                                    ? "gap-3 px-2.5 py-2"
                                    : "justify-center py-2.5"
                            }`}
                            style={
                                active
                                    ? {
                                          background: item.glow,
                                          boxShadow: `inset 4px 0 0 ${item.color}`,
                                      }
                                    : {}
                            }
                            title={!shown ? item.label : undefined}
                        >
                            {/* Icon wrapper */}
                            <div
                                className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-all duration-150"
                                style={
                                    active
                                        ? {
                                              background: `${item.color}1a`,
                                              color: item.color,
                                          }
                                        : {
                                              color: "#7a6a50",
                                          }
                                }
                            >
                                {item.icon}
                            </div>

                            {shown && (
                                <div className="flex flex-1 items-center justify-between min-w-0">
                                    <span
                                        className="text-sm font-bold truncate"
                                        style={{
                                            color: active
                                                ? item.color
                                                : "#9a8870",
                                        }}
                                    >
                                        {item.label}
                                    </span>
                                    {active && (
                                        <span
                                            className="text-xs font-black shrink-0 ml-1"
                                            style={{
                                                color: item.color,
                                                opacity: 0.7,
                                            }}
                                        >
                                            {item.suit}
                                        </span>
                                    )}
                                </div>
                            )}
                        </Link>
                    );
                })}
            </nav>
        );
    }

    /* Bottom nav */
    return (
        <nav className="flex items-stretch justify-around w-full h-full">
            {items.map((item) => {
                const active = isActive(item.href);
                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        className="relative flex flex-col items-center justify-center gap-1 flex-1 text-[10px] font-bold uppercase tracking-wider transition-all"
                        style={{ color: active ? item.color : "#7a6a50" }}
                    >
                        {/* Active top line indicator */}
                        {active && (
                            <span
                                className="absolute top-0 left-1/2 -translate-x-1/2 rounded-b-full"
                                style={{
                                    width: 28,
                                    height: 3,
                                    background: item.color,
                                    boxShadow: `0 0 8px ${item.color}`,
                                }}
                            />
                        )}

                        {/* Icon in colored wrapper when active */}
                        <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-150"
                            style={
                                active
                                    ? {
                                          background: `${item.color}18`,
                                          color: item.color,
                                      }
                                    : {
                                          color: "#7a6a50",
                                      }
                            }
                        >
                            {item.icon}
                        </div>

                        <span>{item.label}</span>
                    </Link>
                );
            })}
        </nav>
    );
}
