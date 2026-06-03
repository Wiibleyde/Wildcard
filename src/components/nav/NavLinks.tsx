"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { HomeIcon, PaletteIcon, PlayIcon, ShopIcon } from "./NavIcons";

type NavItem = {
    href: string;
    label: string;
    icon: React.ReactNode;
};

type Props = {
    variant: "sidebar" | "bottom";
    shown?: boolean;
};

export function NavLinks({ variant, shown = true }: Props) {
    const t = useTranslations("navigation");
    const pathname = usePathname();

    const items: NavItem[] = [
        { href: "/", label: t("home"), icon: <HomeIcon /> },
        { href: "/lobby", label: t("play"), icon: <PlayIcon /> },
        { href: "/shop", label: t("shop"), icon: <ShopIcon /> },
        { href: "/customize", label: t("style"), icon: <PaletteIcon /> },
    ];

    function isActive(href: string) {
        if (href === "/") return pathname === "/";
        return pathname.startsWith(href);
    }

    if (variant === "sidebar") {
        return (
            <nav className="flex flex-col gap-1 mt-5">
                {items.map((item) => {
                    const active = isActive(item.href);
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center rounded-xl font-semibold transition-colors ${
                                shown
                                    ? "gap-3 px-3 py-2.5 text-sm"
                                    : "justify-center py-2.5"
                            }`}
                            style={
                                active
                                    ? {
                                          background: "rgba(255,255,255,0.08)",
                                          color: "#f3f6fc",
                                      }
                                    : { color: "#7c8699" }
                            }
                            title={!shown ? item.label : undefined}
                        >
                            {item.icon}
                            {shown && item.label}
                        </Link>
                    );
                })}
            </nav>
        );
    }

    return (
        <nav className="flex items-center justify-around w-full">
            {items.map((item) => {
                const active = isActive(item.href);
                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        className="flex flex-col items-center gap-1 py-2 px-4 text-[10px] font-bold uppercase tracking-wider transition-colors"
                        style={{ color: active ? "#f3f6fc" : "#566073" }}
                    >
                        {item.icon}
                        {item.label}
                    </Link>
                );
            })}
        </nav>
    );
}
