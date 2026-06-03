import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { getSupabaseEnv } from "@/lib/supabase/env";
import type { Database } from "@/lib/supabase/types";

const locales = ["fr", "en"] as const;
const defaultLocale = "fr";

function getLocale(request: NextRequest): string {
    const acceptLanguage = request.headers.get("accept-language") ?? "";
    for (const part of acceptLanguage.split(",")) {
        const lang = part.trim().split(";")[0].split("-")[0].toLowerCase();
        if ((locales as readonly string[]).includes(lang)) return lang;
    }
    return defaultLocale;
}

export async function proxy(request: NextRequest) {
    // Build base response — Supabase may update it when refreshing tokens
    let response = NextResponse.next({ request: { headers: request.headers } });

    // Refresh session on every request so Server Components always get a valid user
    const { url, anonKey } = getSupabaseEnv();
    const supabase = createServerClient<Database>(url, anonKey, {
        cookies: {
            getAll: () => request.cookies.getAll(),
            setAll: (cookiesToSet) => {
                cookiesToSet.forEach(({ name, value }) => {
                    request.cookies.set(name, value);
                });
                response = NextResponse.next({ request });
                cookiesToSet.forEach(({ name, value, options }) => {
                    response.cookies.set(name, value, options);
                });
            },
        },
    });
    await supabase.auth.getUser();

    // i18n: redirect paths without a locale prefix
    const { pathname } = request.nextUrl;
    const pathnameHasLocale = locales.some(
        (locale) =>
            pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`,
    );

    if (!pathnameHasLocale) {
        const locale = getLocale(request);
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = `/${locale}${pathname}`;
        const redirectResponse = NextResponse.redirect(redirectUrl);
        // Carry refreshed session cookies through the redirect
        response.cookies.getAll().forEach((cookie) => {
            redirectResponse.cookies.set(cookie.name, cookie.value);
        });
        return redirectResponse;
    }

    return response;
}

export const config = {
    // Excludes: _next internals, API routes, OAuth callback, static files
    matcher: ["/((?!_next|api|auth/callback|favicon\\.ico|.*\\..*).*)"],
};
