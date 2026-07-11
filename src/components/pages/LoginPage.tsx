import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { OAuthButton } from "@/components/auth/OAuthButton";
import { DecoSuit } from "@/components/brand/DecoSuit";
import { LogoCard } from "@/components/brand/LogoCard";
import { createClient } from "@/lib/supabase/server";

export async function LoginPage({ lang }: { lang: string }) {
    const tAuth = await getTranslations("auth");
    const tHome = await getTranslations("home");

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (user) redirect(`/${lang}`);

    return (
        <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
            <div
                className="absolute inset-0 pointer-events-none select-none overflow-hidden"
                aria-hidden="true"
            >
                <DecoSuit
                    suit="♠"
                    style={{
                        fontSize: "22rem",
                        opacity: 0.05,
                        color: "var(--cream)",
                        top: "-4rem",
                        left: "-5rem",
                        transform: "rotate(-15deg)",
                    }}
                />
                <DecoSuit
                    suit="♥"
                    style={{
                        fontSize: "22rem",
                        opacity: 0.06,
                        color: "var(--red)",
                        bottom: "-4rem",
                        right: "-5rem",
                        transform: "rotate(12deg)",
                    }}
                />
                <DecoSuit
                    suit="♦"
                    style={{
                        fontSize: "10rem",
                        opacity: 0.05,
                        color: "var(--red)",
                        top: "30%",
                        right: "-2rem",
                        transform: "rotate(6deg)",
                    }}
                />
                <DecoSuit
                    suit="♣"
                    style={{
                        fontSize: "10rem",
                        opacity: 0.05,
                        color: "var(--cream)",
                        bottom: "25%",
                        left: "-2rem",
                        transform: "rotate(-6deg)",
                    }}
                />
            </div>

            <div
                className="panel-d relative w-full max-w-sm lg:max-w-md xl:max-w-lg px-7 py-9"
                style={{ boxShadow: "0 8px 0 var(--ink)" }}
            >
                <div className="text-center mb-8">
                    <div className="relative inline-flex items-center justify-center mb-6">
                        <LogoCard boxShadow="0 6px 0 var(--ink)" />
                        <span
                            className="absolute -top-2 -left-1.5 text-sm font-display"
                            style={{ color: "var(--gold)" }}
                        >
                            ♠
                        </span>
                        <span
                            className="absolute -top-2 -right-1.5 text-sm font-display"
                            style={{ color: "var(--red)" }}
                        >
                            ♥
                        </span>
                        <span
                            className="absolute -bottom-2 -right-1.5 text-sm font-display"
                            style={{ color: "var(--red)" }}
                        >
                            ♦
                        </span>
                        <span
                            className="absolute -bottom-2 -left-1.5 text-sm font-display"
                            style={{ color: "var(--gold)" }}
                        >
                            ♣
                        </span>
                    </div>

                    <h1 className="text-4xl xl:text-5xl font-display text-wc-cream">
                        {tHome("title")}
                    </h1>
                    <p className="sub mt-2 text-sm">{tHome("subtitle")}</p>
                </div>

                <div className="flex items-center gap-3 mb-6">
                    <div
                        className="h-0.5 flex-1"
                        style={{ background: "var(--ink)" }}
                    />
                    <span
                        className="stamp"
                        style={{
                            background: "var(--gold)",
                            color: "var(--ink)",
                        }}
                    >
                        {tAuth("login.title")}
                    </span>
                    <div
                        className="h-0.5 flex-1"
                        style={{ background: "var(--ink)" }}
                    />
                </div>

                <div className="space-y-3">
                    <OAuthButton
                        provider="google"
                        labelOverride={tAuth("login.with_google")}
                    />
                    <OAuthButton
                        provider="discord"
                        labelOverride={tAuth("login.with_discord")}
                    />
                </div>

                <p
                    className="mt-8 text-center text-xs font-display"
                    style={{ color: "var(--muted)" }}
                >
                    ♠ {tHome("title")} ♠
                </p>
            </div>
        </div>
    );
}
