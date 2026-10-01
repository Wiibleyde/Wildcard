"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import {
    HomeIcon,
    PaletteIcon,
    PlayIcon,
    ShieldIcon,
    StudioIcon,
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
    canModerate?: boolean;
};

export function NavLinks({ variant, canModerate = false }: Props) {
    const t = useTranslations("navigation");
    const pathname = usePathname();

    const items: NavItemConfig[] = [
        { href: "/", label: t("home"), icon: <HomeIcon /> },
        { href: "/lobby", label: t("play"), icon: <PlayIcon /> },
        { href: "/leaderboard", label: t("leaderboard"), icon: <TrophyIcon /> },
        { href: "/customize", label: t("style"), icon: <PaletteIcon /> },
        { href: "/studio", label: t("studio"), icon: <StudioIcon /> },
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
                        className={`wc-bnav min-w-0${active ? " wc-bnav--on" : ""}`}
                    >
                        <span className="grid h-5.5 w-5.5 place-items-center">
                            {item.icon}
                        </span>
                        <span className="max-w-full truncate px-0.5">
                            {item.label}
                        </span>
                    </Link>
                );
            })}
        </nav>
    );
}
