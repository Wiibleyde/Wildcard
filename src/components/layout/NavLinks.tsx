"use client";

import { useTranslations } from "next-intl";
import type { CSSProperties, ReactNode } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import {
    HomeIcon,
    PaletteIcon,
    PlayIcon,
    ShieldIcon,
    StudioIcon,
    TrophyIcon,
} from "./NavIcons";

type NavItemConfig = {
    href: string;
    label: string;
    icon: ReactNode;
    /** Fill and pressed shade of the item when it is the current section. */
    color: readonly [string, string];
};

type Props = {
    variant: "sidebar" | "bottom";
    canModerate?: boolean;
};

function isActive(pathname: string, href: string): boolean {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
}

export function NavLinks({ variant, canModerate = false }: Props) {
    const t = useTranslations("navigation");
    const pathname = usePathname();

    const items: NavItemConfig[] = [
        {
            href: "/",
            label: t("home"),
            icon: <HomeIcon />,
            color: ["var(--red)", "var(--red-d)"],
        },
        {
            href: "/lobby",
            label: t("play"),
            icon: <PlayIcon />,
            color: ["var(--orange)", "var(--orange-d)"],
        },
        {
            href: "/leaderboard",
            label: t("leaderboard"),
            icon: <TrophyIcon />,
            color: ["var(--purple)", "var(--purple-d)"],
        },
        {
            href: "/customize",
            label: t("style"),
            icon: <PaletteIcon />,
            color: ["var(--green)", "var(--green-d)"],
        },
        {
            href: "/studio",
            label: t("studio"),
            icon: <StudioIcon />,
            color: ["var(--blue)", "var(--blue-d)"],
        },
        ...(canModerate
            ? [
                  {
                      href: "/admin",
                      label: t("admin"),
                      icon: <ShieldIcon />,
                      color: ["var(--gold-d)", "#6e5414"] as const,
                  },
              ]
            : []),
    ];

    const itemClass = variant === "sidebar" ? "wc-nav" : "wc-bnav min-w-0";

    return (
        <nav
            className={
                variant === "sidebar"
                    ? "flex flex-col gap-2.5"
                    : "flex h-full items-stretch gap-1"
            }
        >
            {items.map((item) => {
                const active = isActive(pathname, item.href);
                const style = {
                    "--nav-c": item.color[0],
                    "--nav-cd": item.color[1],
                } as CSSProperties;
                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={`${itemClass}${active ? ` ${itemClass.split(" ")[0]}--on` : ""}`}
                        style={style}
                    >
                        <span className="grid h-5.5 w-5.5 shrink-0 place-items-center">
                            {item.icon}
                        </span>
                        <span
                            className={
                                variant === "sidebar"
                                    ? "truncate"
                                    : "max-w-full truncate px-0.5"
                            }
                        >
                            {item.label}
                        </span>
                    </Link>
                );
            })}
        </nav>
    );
}
