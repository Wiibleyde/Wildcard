"use server";

// Raw redirect: `next` is already a locale-prefixed path.
import { redirect } from "next/navigation";
import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";

/** The form's `lang` is user input: only a known locale may enter a URL. */
function safeLang(value: FormDataEntryValue | null): string {
    return typeof value === "string" && hasLocale(routing.locales, value)
        ? value
        : routing.defaultLocale;
}

/** Same-origin paths only. Browsers read `\` as `/`, so `/\evil.com` would be protocol-relative. */
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

/** The portal can't set its `.wiibleyde.dev` cookie on localhost; this writes the same session cookie. */
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
