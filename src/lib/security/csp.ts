/**
 * Content Security Policy of every page.
 *
 * Why it matters more here than on a standalone app: the session cookie is the
 * portal's, shared by every `*.wiibleyde.dev` app and readable from JavaScript.
 * One injected script on any of them steals the session for all of them — so
 * no inline script may run unless the server put it there:
 *
 * - `script-src 'nonce-…' 'strict-dynamic'` — a fresh nonce per request
 *   (generated in `proxy.ts`), which Next.js stamps on its own scripts; scripts
 *   those load (e.g. the Umami tag via `next/script`) inherit the trust. No
 *   `'unsafe-inline'`: an injected `<script>` or `onerror=` handler never runs.
 * - `style-src 'unsafe-inline'` — React `style={…}` props and GSAP write inline
 *   styles; CSS cannot execute code, so this is the accepted trade-off.
 * - `connect-src` — only this origin, the shared Supabase (REST + Realtime
 *   websocket), the portal API and Umami: where the access token may go.
 * - `frame-ancestors 'none'` — no clickjacking from a sibling subdomain.
 */
export interface CspSources {
    readonly supabaseUrl: string;
    readonly portalUrl: string;
    readonly umamiUrl: string;
    readonly dev: boolean;
}

/** `https://x.y/path` → `https://x.y`; empty / invalid → null. */
function originOf(url: string): string | null {
    if (!url) return null;
    try {
        return new URL(url).origin;
    } catch {
        return null;
    }
}

/** Realtime: the websocket twin of an http(s) origin. */
function wsOriginOf(origin: string): string {
    return origin.replace(/^http/, "ws");
}

/** A fresh, unguessable nonce (128 bits, base64). */
export function generateNonce(): string {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return btoa(String.fromCharCode(...bytes));
}

export function buildCsp(nonce: string, sources: CspSources): string {
    const supabase = originOf(sources.supabaseUrl);
    const portal = originOf(sources.portalUrl);
    const umami = originOf(sources.umamiUrl);

    const connect = ["'self'"];
    if (supabase) connect.push(supabase, wsOriginOf(supabase));
    if (portal) connect.push(portal);
    if (umami) connect.push(umami);
    // Turbopack HMR websocket in `next dev`.
    if (sources.dev) connect.push("ws:", "wss:");

    const img = ["'self'", "data:", "blob:"];
    if (supabase) img.push(supabase);

    const script = ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"];
    // React rebuilds server error stacks with eval() in development only.
    if (sources.dev) script.push("'unsafe-eval'");

    const directives = [
        "default-src 'self'",
        `script-src ${script.join(" ")}`,
        "style-src 'self' 'unsafe-inline'",
        `img-src ${img.join(" ")}`,
        "font-src 'self' data:",
        `connect-src ${connect.join(" ")}`,
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        ...(sources.dev ? [] : ["upgrade-insecure-requests"]),
    ];
    return directives.join("; ");
}
