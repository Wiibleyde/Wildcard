"use client";

import { useLocale, useTranslations } from "next-intl";
import { useSignOut } from "@/hooks/auth/useSignOut";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { IconSvg } from "./IconSvg";

function GlobeIcon() {
    return (
        <IconSvg className="w-3.5 h-3.5 shrink-0" strokeWidth="1.8">
            <circle cx="12" cy="12" r="9" />
            <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </IconSvg>
    );
}

function LogoutIcon() {
    return (
        <IconSvg className="w-3.5 h-3.5 shrink-0" strokeWidth="1.8">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
        </IconSvg>
    );
}

type Props = {
    variant: "sidebar" | "mobile-header";
};

export function NavActions({ variant }: Props) {
    const t = useTranslations("navigation");
    const locale = useLocale();
    const router = useRouter();
    const pathname = usePathname();
    const handleSignOut = useSignOut();

    const otherLang =
        routing.locales.find((l) => l !== locale) ?? routing.defaultLocale;
    const switchLabel = t("switch_lang", { lang: otherLang.toUpperCase() });

    function switchLang() {
        // Keep the query string and hash (e.g. history filters, replay step):
        // `pathname` from next-intl is locale-less and carries neither. Read at
        // click time rather than via useSearchParams, which would force a
        // Suspense boundary around the whole nav during prerender.
        const { search, hash } = window.location;
        router.replace(`${pathname}${search}${hash}`, { locale: otherLang });
    }

    if (variant === "sidebar") {
        return (
            <div className="flex flex-col gap-1">
                <div
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold w-full"
                    style={{ color: "var(--muted)" }}
                >
                    <GlobeIcon />
                    <div className="flex items-center gap-0.5 ml-1">
                        {routing.locales.map((l) => (
                            <button
                                key={l}
                                type="button"
                                onClick={l !== locale ? switchLang : undefined}
                                disabled={l === locale}
                                aria-pressed={l === locale}
                                aria-label={
                                    l === locale ? undefined : switchLabel
                                }
                                className="px-2 py-0.5 rounded text-xs font-bold uppercase transition-colors"
                                style={
                                    l === locale
                                        ? {
                                              color: "var(--ink)",
                                              background: "var(--gold)",
                                          }
                                        : { color: "var(--muted)" }
                                }
                            >
                                {l}
                            </button>
                        ))}
                    </div>
                </div>
                <button
                    type="button"
                    onClick={handleSignOut}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-colors hover:bg-white/5 w-full"
                    style={{ color: "var(--muted)" }}
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
                style={{ color: "var(--muted)" }}
                aria-label={switchLabel}
                title={switchLabel}
            >
                <GlobeIcon />
            </button>
            <button
                type="button"
                onClick={handleSignOut}
                className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors hover:bg-white/5"
                style={{ color: "var(--muted)" }}
                aria-label={t("logout")}
                title={t("logout")}
            >
                <LogoutIcon />
            </button>
        </div>
    );
}
