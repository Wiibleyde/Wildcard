"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Only same-origin paths: never bounce to an attacker-chosen site. */
function safeNext(next: FormDataEntryValue | null, lang: string): string {
    const value = typeof next === "string" ? next : "";
    return value.startsWith("/") && !value.startsWith("//")
        ? value
        : `/${lang}`;
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
    const lang = String(formData.get("lang") ?? "fr");
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
