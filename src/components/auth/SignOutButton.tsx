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
            className="text-sm text-gray-500 hover:text-gray-300 transition-colors cursor-pointer"
        >
            {t("sign_out")}
        </button>
    );
}
