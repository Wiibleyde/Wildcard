import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loginUrl } from "./urls";

/**
 * From `getClaims()` (verified signature), never `getSession()`, which only
 * decodes the cookie, nor `user_metadata`, which the user can edit.
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

/** Signed-out visitors go to the portal login, which brings them back to `path`. */
export async function requireAuthUser(
    lang: string,
    path: string,
): Promise<AuthUser> {
    const user = await getAuthUser();
    if (!user) redirect(loginUrl(path, lang));
    return user;
}
