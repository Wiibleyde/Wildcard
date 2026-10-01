import { getLocale, getTranslations } from "next-intl/server";
import { GameButton } from "@/components/ui/GameButton";
import { loginHref } from "@/lib/auth/urls";
import { Brand } from "./Brand";

// Top bar for signed-out visitors: AppNav needs a user, so guests would otherwise
// get an empty sidebar gap and no way in.
export async function GuestNav() {
    const t = await getTranslations("navigation");
    const lang = await getLocale();

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

                <GameButton
                    href={loginHref(`/${lang}`)}
                    variant="green"
                    size="sm"
                >
                    <span style={{ fontSize: "1.1em" }}>♠</span>
                    {t("login")}
                </GameButton>
            </div>
        </header>
    );
}
