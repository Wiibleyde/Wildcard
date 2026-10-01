"use server";

import { redirect } from "next/navigation";
import { routing } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";

/** The form's `lang` is user input: only a known locale may enter a URL. */
function safeLang(value: FormDataEntryValue | null): string {
    return typeof value === "string" &&
        (routing.locales as readonly string[]).includes(value)
        ? value
        : routing.defaultLocale;
}

/**
 * Only same-origin paths: never bounce to an attacker-chosen site. Browsers
 * treat `\` like `/` in URLs, so `/\evil.com` would be protocol-relative —
 * any backslash is refused, as is `//` anywhere and control characters.
 */
function safeNext(next: FormDataEntryValue | null, lang: string): string {
    const value = typeof next === "string" ? next : "";
    const ok =
        value.startsWith("/") &&
        !value.includes("//") &&
        !value.includes("\\") &&
        // biome-ignore lint/suspicious/noControlCharactersInRegex: rejecting them is the point
        !/[\u0000-\u001f\u007f]/.test(value);
    return ok ? value : `/${lang}`;
}

/**
 * Dev-only sign-in with email/password — stands in for the portal, which cannot
 * set its `.wiibleyde.dev` cookie on localhost. The server client writes the
 * session cookie exactly as the portal would (same name, raw encoding).
 */
export async function devSignIn(formData: FormData): Promise<void> {
    if (process.env.NODE_ENV !== "development") {
        throw new Error("dev-login is only available under `next dev`");
    }
    const lang = safeLang(formData.get("lang"));
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });
    if (error) {
        redirect(
            `/${lang}/dev-login?error=${encodeURIComponent(error.message)}`,
        );
    }
    redirect(safeNext(formData.get("next"), lang));
}
