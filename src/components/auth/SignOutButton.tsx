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
            className="text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg cursor-pointer transition-colors"
            style={{
                color: "#7a6a50",
                border: "1px solid #3d2d18",
                background: "rgba(255,255,255,0.03)",
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.color = "#e04040";
                e.currentTarget.style.borderColor = "rgba(224,64,64,0.35)";
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.color = "#7a6a50";
                e.currentTarget.style.borderColor = "#3d2d18";
            }}
        >
            {t("sign_out")}
        </button>
    );
}
