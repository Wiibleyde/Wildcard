"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import {
    HomeIcon,
    PaletteIcon,
    PlayIcon,
    ShieldIcon,
    ShopIcon,
    TrophyIcon,
} from "./NavIcons";
import { isActive } from "./navUtils";

type NavItemConfig = {
    href: string;
    label: string;
    icon: React.ReactNode;
};

type Props = {
    variant: "sidebar" | "bottom";
    shown?: boolean;
    canModerate?: boolean;
};

export function NavLinks({ variant, canModerate = false }: Props) {
    const t = useTranslations("navigation");
    const pathname = usePathname();

    const items: NavItemConfig[] = [
        { href: "/", label: t("home"), icon: <HomeIcon /> },
        { href: "/lobby", label: t("play"), icon: <PlayIcon /> },
        { href: "/leaderboard", label: t("leaderboard"), icon: <TrophyIcon /> },
        { href: "/shop", label: t("shop"), icon: <ShopIcon /> },
        { href: "/customize", label: t("style"), icon: <PaletteIcon /> },
        ...(canModerate
            ? [{ href: "/admin", label: t("admin"), icon: <ShieldIcon /> }]
            : []),
    ];

    if (variant === "sidebar") {
        return (
            <nav className="flex flex-col gap-1.25">
                {items.map((item) => {
                    const active = isActive(pathname, item.href);
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`wc-nav${active ? " wc-nav--on" : ""}`}
                        >
                            <span className="grid h-5.5 w-5.5 shrink-0 place-items-center">
                                {item.icon}
                            </span>
                            <span className="truncate">{item.label}</span>
                        </Link>
                    );
                })}
            </nav>
        );
    }

    return (
        <nav className="flex h-full items-stretch">
            {items.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={`wc-bnav${active ? " wc-bnav--on" : ""}`}
                    >
                        <span className="grid h-5.5 w-5.5 place-items-center">
                            {item.icon}
                        </span>
                        <span>{item.label}</span>
                    </Link>
                );
            })}
        </nav>
    );
}
