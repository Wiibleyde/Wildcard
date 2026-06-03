"use client";

import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { signOut } from "@/lib/supabase/auth";

function GlobeIcon() {
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
      <circle cx="12" cy="12" r="9" />
      <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function LogoutIcon() {
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
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
    </svg>
  );
}

type Props = {
  variant: "sidebar" | "mobile-header";
};

export function NavActions({ variant }: Props) {
  const t = useTranslations("navigation");
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();

  const lang = (params?.lang as string) ?? "fr";
  const otherLang = lang === "fr" ? "en" : "fr";

  function switchLang() {
    router.push(`/${otherLang}${pathname}`);
  }

  async function handleSignOut() {
    await signOut();
    router.push(`/${lang}/login`);
    router.refresh();
  }

  if (variant === "sidebar") {
    return (
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={switchLang}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-colors hover:bg-white/5 w-full"
          style={{ color: "#7c8699" }}
        >
          <GlobeIcon />
          <span className="uppercase">{otherLang}</span>
        </button>
        <button
          type="button"
          onClick={handleSignOut}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-colors hover:bg-white/5 w-full"
          style={{ color: "#7c8699" }}
        >
          <LogoutIcon />
          {t("logout")}
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={switchLang}
        className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors hover:bg-white/5"
        style={{ color: "#7c8699" }}
        aria-label={`Switch to ${otherLang}`}
      >
        <GlobeIcon />
      </button>
      <button
        type="button"
        onClick={handleSignOut}
        className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors hover:bg-white/5"
        style={{ color: "#7c8699" }}
        aria-label={t("logout")}
      >
        <LogoutIcon />
      </button>
    </div>
  );
}
