import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppRole } from "@/lib/auth/roles";
import type { AuthUser } from "@/lib/auth/session";
import { type AdminClient, createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";
import { requireRole, requireUser } from "./auth";
import { DEFAULT_MAX_BODY_BYTES, readJsonObject } from "./body";
import { type RateLimitGroup, rateLimit } from "./rateLimit";
import { InvalidInput, invalidInput } from "./validate";

export interface ApiRouteOptions {
    /** Minimum global role; omitted = any signed-in user. */
    readonly role?: AppRole;
    /** Every group is charged, in order. */
    readonly rateLimit?: RateLimitGroup | readonly RateLimitGroup[];
    /** Parse the body as a JSON object (`{}` when empty). */
    readonly body?: boolean;
    readonly maxBodyBytes?: number;
}

export interface ApiContext<P> {
    readonly request: Request;
    readonly params: P;
    readonly user: AuthUser;
    /** RLS client acting as the caller. */
    readonly supabase: SupabaseClient<Database>;
    /** `{}` unless `options.body`. */
    readonly body: Readonly<Record<string, unknown>>;
    /** Service-role client, created on first use — only after the checks above. */
    readonly admin: AdminClient;
}

type RouteHandler<P> = (
    request: Request,
    ctx: { params: Promise<P> },
) => Promise<Response>;

/**
 * The shared route pipeline: params → bearer auth (+ role, maintenance) →
 * rate limit → body → handler. Field readers throwing {@link InvalidInput}
 * become a 400 `invalid_input`.
 */
export function apiRoute<P = Record<string, never>>(
    options: ApiRouteOptions,
    handler: (ctx: ApiContext<P>) => Promise<Response>,
): RouteHandler<P> {
    const groups =
        options.rateLimit === undefined
            ? []
            : typeof options.rateLimit === "string"
              ? [options.rateLimit]
              : options.rateLimit;

    return async (request, ctx) => {
        const params = await ctx.params;
        const auth = options.role
            ? await requireRole(request, options.role)
            : await requireUser(request);
        if (!auth.ok) return auth.response;

        for (const group of groups) {
            const limited = rateLimit(group, auth.user.id);
            if (limited) return limited;
        }

        let body: Record<string, unknown> = {};
        if (options.body) {
            const parsed = await readJsonObject(
                request,
                options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES,
            );
            if (!parsed.ok) return parsed.response;
            body = parsed.body;
        }

        let admin: AdminClient | undefined;
        try {
            return await handler({
                request,
                params,
                user: auth.user,
                supabase: auth.supabase,
                body,
                get admin() {
                    admin ??= createAdminClient();
                    return admin;
                },
            });
        } catch (err) {
            if (err instanceof InvalidInput) return invalidInput(err.field);
            throw err;
        }
    };
}
