"use client";

import { useTranslations } from "next-intl";
import { GameButton } from "@/components/ui/GameButton";
import { useSignOut } from "@/hooks/auth/useSignOut";

export function SignOutButton() {
    const t = useTranslations("profile");
    const handleSignOut = useSignOut();

    return (
        <GameButton variant="cream" size="sm" onClick={handleSignOut}>
            {t("sign_out")}
        </GameButton>
    );
}
