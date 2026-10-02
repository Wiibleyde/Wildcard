/**
 * The session cookie is shared by every *.wiibleyde.dev app and readable from
 * JS, so one injected script would steal it everywhere: no inline script runs
 * without the per-request nonce. Inline *styles* are allowed (React `style`,
 * GSAP); CSS cannot execute code. `connect-src` lists where the token may go.
 */
export interface CspSources {
    readonly supabaseUrl: string;
    readonly portalUrl: string;
    readonly umamiUrl: string;
    readonly dev: boolean;
}

function originOf(url: string): string | null {
    if (!url) return null;
    try {
        return new URL(url).origin;
    } catch {
        return null;
    }
}

function wsOriginOf(origin: string): string {
    return origin.replace(/^http/, "ws");
}

/** 128 bits, base64. */
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
    // Turbopack HMR websocket.
    if (sources.dev) connect.push("ws:", "wss:");

    const img = ["'self'", "data:", "blob:"];
    if (supabase) img.push(supabase);

    const script = ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"];
    // React rebuilds server error stacks with eval() in development.
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
