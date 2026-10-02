import { type CookieOptions, createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { getUserRole, roleAtLeast } from "@/lib/auth/roles";
import { localeFromPath, pathSegments } from "@/lib/locale";
import { getAppSettings } from "@/lib/models/settings";
import { readPublicEnvFromProcess } from "@/lib/public-env";
import { buildCsp, generateNonce } from "@/lib/security/csp";
import {
    getServerSupabaseEnv,
    supabaseSharedOptions,
} from "@/lib/supabase/env";
import type { Database } from "@/lib/supabase/types";
import { routing } from "./i18n/routing";

const handleI18nRouting = createMiddleware(routing);

type PendingCookie = { name: string; value: string; options: CookieOptions };

/** First segment after the locale; prod sign-in happens on the portal, outside this app. */
const MAINTENANCE_ALLOW = new Set(["maintenance", "dev-login"]);

export async function proxy(request: NextRequest) {
    // Nonce on the request headers for Next to stamp its scripts, on the response for the browser.
    const env = readPublicEnvFromProcess();
    const nonce = generateNonce();
    const csp = buildCsp(nonce, {
        supabaseUrl: env.SUPABASE_URL,
        portalUrl: env.PORTAL_URL,
        umamiUrl: env.UMAMI_URL,
        dev: process.env.NODE_ENV === "development",
    });
    request.headers.set("x-nonce", nonce);
    request.headers.set("Content-Security-Policy", csp);

    const pendingCookies: PendingCookie[] = [];

    const { url, anonKey } = getServerSupabaseEnv();
    const supabase = createServerClient<Database>(url, anonKey, {
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
    // Right after creating the client: refreshes an expired session. Any await
    // in between risks acting on a stale one.
    const { data: claimsData } = await supabase.auth.getClaims();
    const userId = claimsData?.claims?.sub ?? null;

    const withCookies = (response: NextResponse) => {
        for (const { name, value, options } of pendingCookies) {
            response.cookies.set(name, value, options);
        }
        response.headers.set("Content-Security-Policy", csp);
        return response;
    };

    const pathname = request.nextUrl.pathname;
    const settings = await getAppSettings(supabase);
    if (
        settings.maintenance &&
        !MAINTENANCE_ALLOW.has(pathSegments(pathname).rest[0] ?? "")
    ) {
        const isAdmin =
            userId !== null &&
            roleAtLeast(await getUserRole(supabase, userId), "admin");
        if (!isAdmin) {
            const target = request.nextUrl.clone();
            target.pathname = `/${localeFromPath(pathname)}/maintenance`;
            return withCookies(
                NextResponse.rewrite(target, {
                    request: { headers: request.headers },
                }),
            );
        }
    }

    return withCookies(handleI18nRouting(request));
}

export const config = {
    // API routes authenticate by bearer token and need neither CSP nor this refresh.
    matcher: ["/((?!_next|api|favicon\\.ico|.*\\..*).*)"],
};
