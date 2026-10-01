import { type CookieOptions, createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { getAppSettings } from "@/lib/models/settings";
import {
    getServerSupabaseEnv,
    supabaseSharedOptions,
} from "@/lib/supabase/env";
import type { Database } from "@/lib/supabase/types";
import { routing } from "./i18n/routing";

const handleI18nRouting = createMiddleware(routing);

type PendingCookie = { name: string; value: string; options: CookieOptions };

/**
 * Paths that stay reachable during maintenance: the maintenance page itself
 * (no rewrite loop) and the dev login page. In prod, sign-in happens on the
 * portal, outside this app, so a signed-out admin is never blocked from it.
 * Matched anywhere in the path so the locale prefix is irrelevant.
 */
const MAINTENANCE_ALLOW = ["/maintenance", "/dev-login"];

function localeFromPath(pathname: string): string {
    const seg = pathname.split("/")[1];
    return (routing.locales as readonly string[]).includes(seg)
        ? seg
        : routing.defaultLocale;
}

export async function proxy(request: NextRequest) {
    const pendingCookies: PendingCookie[] = [];

    const { url, anonKey } = getServerSupabaseEnv();
    const supabase = createServerClient<Database>(url, anonKey, {
        // Same cookie name/encoding/domain as every client and the portal (env.ts).
        ...supabaseSharedOptions(),
        cookies: {
            getAll: () => request.cookies.getAll(),
            setAll: (cookiesToSet) => {
                for (const { name, value } of cookiesToSet) {
                    request.cookies.set(name, value);
                }
                pendingCookies.push(...cookiesToSet);
            },
        },
    });
    // Must run right after creating the client: it refreshes an expired session
    // (writing the new cookie via setAll) and verifies the JWT signature. Any
    // await in between risks acting on a stale session.
    const { data: claimsData } = await supabase.auth.getClaims();
    const userId = claimsData?.claims?.sub ?? null;

    /** Carry the refreshed session cookies onto whatever response we return. */
    const withCookies = (response: NextResponse) => {
        for (const { name, value, options } of pendingCookies) {
            response.cookies.set(name, value, options);
        }
        return response;
    };

    // ── Maintenance gate ─────────────────────────────────────────────────
    // When maintenance is on, everyone except admins is rewritten to the
    // maintenance page. One settings read per navigation (assets/api/_next are
    // excluded by the matcher below); the role is read only while it's on.
    const pathname = request.nextUrl.pathname;
    const settings = await getAppSettings(supabase);
    if (
        settings.maintenance &&
        !MAINTENANCE_ALLOW.some((p) => pathname.includes(p))
    ) {
        let isAdmin = false;
        if (userId) {
            const { data } = await supabase
                .from("user_roles")
                .select("role")
                .eq("user_id", userId)
                .maybeSingle();
            isAdmin = data?.role === "admin";
        }
        if (!isAdmin) {
            const url = request.nextUrl.clone();
            url.pathname = `/${localeFromPath(pathname)}/maintenance`;
            return withCookies(NextResponse.rewrite(url));
        }
    }

    // next-intl handles locale negotiation, redirects, rewrites, and alt links
    return withCookies(handleI18nRouting(request));
}

export const config = {
    // Excludes: _next internals, API routes, static files
    matcher: ["/((?!_next|api|favicon\\.ico|.*\\..*).*)"],
};
