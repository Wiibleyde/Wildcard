import { publicEnv } from "@/lib/public-env";

/**
 * Auth URLs. Sign-in, sign-up and account management live on the portal of the
 * wiibleyde.dev infra (`https://auth.wiibleyde.dev`), which writes a session
 * cookie for the whole domain and redirects back to `next` — any https URL
 * under `.wiibleyde.dev` is accepted.
 *
 * Without a portal (local dev: PORTAL_URL unset), login falls back to the
 * dev-only `/[lang]/dev-login` page, which signs in seeded accounts.
 */

/**
 * Absolute URL of an app path. Built from APP_URL, not the request origin:
 * behind Caddy the request origin is the container's internal address, which
 * the portal would (rightly) refuse as a redirect target.
 */
export function absoluteAppUrl(path: string, fallbackOrigin?: string): string {
    const base =
        publicEnv().APP_URL || fallbackOrigin || "http://localhost:3000";
    return new URL(path, base).toString();
}

/** Where to send a signed-out visitor so they come back to `path`. */
export function loginUrl(path: string, lang: string): string {
    const portal = publicEnv().PORTAL_URL;
    if (!portal) {
        return `/${lang}/dev-login?next=${encodeURIComponent(path)}`;
    }
    return `${portal}/login?next=${encodeURIComponent(absoluteAppUrl(path))}`;
}

/**
 * Same target as {@link loginUrl}, for the locale-aware `<Link>` of
 * `@/i18n/navigation`, which adds the locale prefix itself: the portal URL
 * (absolute, left untouched by the Link) or the unprefixed dev page.
 */
export function loginHref(path: string): string {
    const portal = publicEnv().PORTAL_URL;
    if (!portal) return `/dev-login?next=${encodeURIComponent(path)}`;
    return `${portal}/login?next=${encodeURIComponent(absoluteAppUrl(path))}`;
}

/** Portal account page (pseudo, avatar, linked accounts) — null without portal. */
export function accountUrl(): string | null {
    const portal = publicEnv().PORTAL_URL;
    return portal ? `${portal}/account` : null;
}
