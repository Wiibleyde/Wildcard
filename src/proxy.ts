import { type CookieOptions, createServerClient } from "@supabase/ssr";
import type { NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { getSupabaseEnv } from "@/lib/supabase/env";
import type { Database } from "@/lib/supabase/types";
import { routing } from "./i18n/routing";

const handleI18nRouting = createMiddleware(routing);

type PendingCookie = { name: string; value: string; options: CookieOptions };

export async function proxy(request: NextRequest) {
    const pendingCookies: PendingCookie[] = [];

    const { url, anonKey } = getSupabaseEnv();
    const supabase = createServerClient<Database>(url, anonKey, {
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
    await supabase.auth.getUser();

    // next-intl handles locale negotiation, redirects, rewrites, and alt links
    const response = handleI18nRouting(request);

    // Carry refreshed session cookies into the i18n response
    for (const { name, value, options } of pendingCookies) {
        response.cookies.set(name, value, options);
    }

    return response;
}

export const config = {
    // Excludes: _next internals, API routes, OAuth callback, static files
    matcher: ["/((?!_next|api|auth/callback|favicon\\.ico|.*\\..*).*)"],
};
