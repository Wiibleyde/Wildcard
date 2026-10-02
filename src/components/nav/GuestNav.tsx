import { getLocale, getTranslations } from "next-intl/server";
import { GameButton } from "@/components/ui/GameButton";
import { loginHref, signupUrl } from "@/lib/auth/urls";
import { Brand } from "./Brand";

export async function GuestNav() {
    const t = await getTranslations("navigation");
    const lang = await getLocale();
    // Portal-only: null in local dev.
    const signup = signupUrl(`/${lang}`);

    return (
        <header
            className="sticky top-0 z-40"
            style={{
                background: "var(--panel-d2)",
                borderBottom: "3px solid var(--ink)",
            }}
        >
            <div className="flex items-center justify-between px-4 xl:px-10 h-14">
                <Brand size="sm" />

                <div className="flex items-center gap-2">
                    {signup && (
                        // Hidden on phones (overflows 375px); the portal login links to sign-up anyway.
                        <span className="hidden sm:block">
                            <GameButton href={signup} variant="ghost" size="sm">
                                {t("signup")}
                            </GameButton>
                        </span>
                    )}
                    <GameButton
                        href={loginHref(`/${lang}`)}
                        variant="green"
                        size="sm"
                    >
                        <span aria-hidden="true" className="text-[1.1em]">
                            ♠
                        </span>
                        {t("login")}
                    </GameButton>
                </div>
            </div>
        </header>
    );
}
