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

/** Portal URL `<portal><route>?next=<absolute app URL of path>`. */
function portalWithNext(portal: string, route: string, path: string): string {
    return `${portal}${route}?next=${encodeURIComponent(absoluteAppUrl(path))}`;
}

/** Where to send a signed-out visitor so they come back to `path`. */
export function loginUrl(path: string, lang: string): string {
    const portal = publicEnv().PORTAL_URL;
    if (!portal) {
        return `/${lang}/dev-login?next=${encodeURIComponent(path)}`;
    }
    return portalWithNext(portal, "/login", path);
}

/**
 * Same target as {@link loginUrl}, for the locale-aware `<Link>` of
 * `@/i18n/navigation`, which adds the locale prefix itself: the portal URL
 * (absolute, left untouched by the Link) or the unprefixed dev page.
 */
export function loginHref(path: string): string {
    const portal = publicEnv().PORTAL_URL;
    if (!portal) return `/dev-login?next=${encodeURIComponent(path)}`;
    return portalWithNext(portal, "/login", path);
}

/** Portal sign-up, coming back to `path` — null without portal (dev). */
export function signupUrl(path: string): string | null {
    const portal = publicEnv().PORTAL_URL;
    return portal ? portalWithNext(portal, "/signup", path) : null;
}

/**
 * Portal "forgotten password" page — null without portal. Password reset is
 * the portal's: the recovery mail always lands on `auth.wiibleyde.dev/reset`,
 * so the app never calls `resetPasswordForEmail` itself.
 */
export function forgotPasswordUrl(): string | null {
    const portal = publicEnv().PORTAL_URL;
    return portal ? `${portal}/forgot` : null;
}

/**
 * Portal account page (pseudo, profile picture, friends, blocks, linked
 * accounts) — the portal root. Null without portal.
 */
export function accountUrl(): string | null {
    const portal = publicEnv().PORTAL_URL;
    return portal ? `${portal}/` : null;
}

/** Base of the portal's JSON API (`/api/v1`) — null without portal. */
export function portalApiUrl(): string | null {
    const portal = publicEnv().PORTAL_URL;
    return portal ? `${portal.replace(/\/$/, "")}/api/v1` : null;
}
