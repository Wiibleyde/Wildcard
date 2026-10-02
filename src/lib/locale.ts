import { hasLocale, type Locale } from "next-intl";
import { routing } from "@/i18n/routing";

/** Path segments without the leading locale, if any. */
export function pathSegments(pathname: string): {
    locale: Locale | null;
    rest: string[];
} {
    const [first, ...others] = pathname.split("/").filter(Boolean);
    return hasLocale(routing.locales, first)
        ? { locale: first, rest: others }
        : { locale: null, rest: first === undefined ? [] : [first, ...others] };
}

export function localeFromPath(pathname: string): Locale {
    return pathSegments(pathname).locale ?? routing.defaultLocale;
}
