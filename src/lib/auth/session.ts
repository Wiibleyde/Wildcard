import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loginUrl } from "./urls";

/**
 * The signed-in account, as asserted by the session JWT.
 *
 * Identity comes from `auth.getClaims()`: the token's signature is verified
 * (ES256 against the instance JWKS on the shared stack), so the result can be
 * trusted for authorization — unlike `getSession()`, which only decodes the
 * cookie. Never authorize on `user_metadata`: the user can edit it.
 */
export interface AuthUser {
    readonly id: string;
    readonly email: string | null;
}

export async function getAuthUser(): Promise<AuthUser | null> {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    const claims = data?.claims;
    if (!claims?.sub) return null;
    return {
        id: claims.sub,
        email: typeof claims.email === "string" ? claims.email : null,
    };
}

/**
 * Like {@link getAuthUser}, for pages that require a session: a signed-out
 * visitor is sent to the portal login, which brings them back to `path`.
 */
export async function requireAuthUser(
    lang: string,
    path: string,
): Promise<AuthUser> {
    const user = await getAuthUser();
    if (!user) redirect(loginUrl(path, lang));
    return user;
}
