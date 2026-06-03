"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HomeIcon, PaletteIcon, PlayIcon, ShopIcon } from "./NavIcons";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

type Props = {
  lang: string;
  variant: "sidebar" | "bottom";
};

export function NavLinks({ lang, variant }: Props) {
  const pathname = usePathname();

  const items: NavItem[] = [
    {
      href: `/${lang}`,
      label: lang === "fr" ? "Accueil" : "Home",
      icon: <HomeIcon />,
    },
    {
      href: `/${lang}/lobby`,
      label: lang === "fr" ? "Jouer" : "Play",
      icon: <PlayIcon />,
    },
    {
      href: `/${lang}/shop`,
      label: lang === "fr" ? "Boutique" : "Shop",
      icon: <ShopIcon />,
    },
    { href: `/${lang}/customize`, label: "Style", icon: <PaletteIcon /> },
  ];

  function isActive(href: string) {
    if (href === `/${lang}`)
      return pathname === `/${lang}` || pathname === `/${lang}/`;
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
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors"
              style={
                active
                  ? { background: "rgba(255,255,255,0.08)", color: "#f3f6fc" }
                  : { color: "#7c8699" }
              }
            >
              {item.icon}
              {item.label}
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
