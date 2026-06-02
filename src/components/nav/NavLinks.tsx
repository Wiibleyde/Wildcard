"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

function HomeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 10.5 12 3l9 7.5M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" />
    </svg>
  );
}
function PlayIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}
function ShopIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 7h16l-1 13H5L4 7zm3 0a5 5 0 0 1 10 0" />
    </svg>
  );
}

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
