"use client";

import { useTranslations } from "next-intl";
import { useSignOut } from "@/hooks/auth/useSignOut";

export function SignOutButton() {
    const t = useTranslations("profile");
    const handleSignOut = useSignOut();

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
