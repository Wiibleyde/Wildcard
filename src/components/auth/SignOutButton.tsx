"use client";

import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { signOut } from "@/lib/supabase/auth";

export function SignOutButton() {
    const t = useTranslations("profile");
    const params = useParams();
    const lang = (params?.lang as string) ?? "fr";
    const router = useRouter();

    async function handleSignOut() {
        await signOut();
        router.push(`/${lang}/login`);
        router.refresh();
    }

    return (
        <button
            type="button"
            onClick={handleSignOut}
            className="wc-btn px-4 py-2 text-sm"
            style={{ background: "var(--cream)", color: "var(--ink)" }}
        >
            {t("sign_out")}
        </button>
    );
}
