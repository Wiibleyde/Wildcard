import { publicEnv } from "@/lib/public-env";

// Sign-in and account management live on the portal; without one (local dev,
// PORTAL_URL unset) login falls back to the dev-only `/[lang]/dev-login` page.

/** From APP_URL: behind Caddy the request origin is the container's internal address. */
export function absoluteAppUrl(path: string, fallbackOrigin?: string): string {
    const base =
        publicEnv().APP_URL || fallbackOrigin || "http://localhost:3000";
    return new URL(path, base).toString();
}

function portalWithNext(portal: string, route: string, path: string): string {
    return `${portal}${route}?next=${encodeURIComponent(absoluteAppUrl(path))}`;
}

export function loginUrl(path: string, lang: string): string {
    const portal = publicEnv().PORTAL_URL;
    if (!portal) {
        return `/${lang}/dev-login?next=${encodeURIComponent(path)}`;
    }
    return portalWithNext(portal, "/login", path);
}

/** {@link loginUrl} for the locale-aware `<Link>`, which adds the prefix itself. */
export function loginHref(path: string): string {
    const portal = publicEnv().PORTAL_URL;
    if (!portal) return `/dev-login?next=${encodeURIComponent(path)}`;
    return portalWithNext(portal, "/login", path);
}

export function signupUrl(path: string): string | null {
    const portal = publicEnv().PORTAL_URL;
    return portal ? portalWithNext(portal, "/signup", path) : null;
}

/** Password reset is the portal's alone. */
export function forgotPasswordUrl(): string | null {
    const portal = publicEnv().PORTAL_URL;
    return portal ? `${portal}/forgot` : null;
}

export function accountUrl(): string | null {
    const portal = publicEnv().PORTAL_URL;
    return portal ? `${portal}/` : null;
}

export function portalApiUrl(): string | null {
    const portal = publicEnv().PORTAL_URL;
    return portal ? `${portal.replace(/\/$/, "")}/api/v1` : null;
}
