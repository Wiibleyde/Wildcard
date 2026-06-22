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
        <div
            className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden"
            style={{ background: "#0d0a05" }}
        >
            <div
                className="absolute inset-0 pointer-events-none select-none overflow-hidden"
                aria-hidden="true"
            >
                <DecoSuit
                    suit="♠"
                    style={{
                        fontSize: "22rem",
                        opacity: 0.025,
                        color: "#f0e8d4",
                        top: "-4rem",
                        left: "-5rem",
                        transform: "rotate(-15deg)",
                    }}
                />
                <DecoSuit
                    suit="♥"
                    style={{
                        fontSize: "22rem",
                        opacity: 0.025,
                        color: "#e04040",
                        bottom: "-4rem",
                        right: "-5rem",
                        transform: "rotate(12deg)",
                    }}
                />
                <DecoSuit
                    suit="♦"
                    style={{
                        fontSize: "10rem",
                        opacity: 0.02,
                        color: "#e04040",
                        top: "30%",
                        right: "-2rem",
                        transform: "rotate(6deg)",
                    }}
                />
                <DecoSuit
                    suit="♣"
                    style={{
                        fontSize: "10rem",
                        opacity: 0.02,
                        color: "#f0e8d4",
                        bottom: "25%",
                        left: "-2rem",
                        transform: "rotate(-6deg)",
                    }}
                />
            </div>

            <div className="relative w-full max-w-sm lg:max-w-md xl:max-w-lg">
                <div className="text-center mb-10">
                    <div className="relative inline-flex items-center justify-center mb-6">
                        <LogoCard boxShadow="0 0 48px rgba(245,197,22,0.28), 0 6px 24px rgba(0,0,0,0.55)" />
                        <span
                            className="absolute -top-2 -left-1.5 text-sm font-black"
                            style={{ color: "#f5c516", opacity: 0.7 }}
                        >
                            ♠
                        </span>
                        <span
                            className="absolute -top-2 -right-1.5 text-sm font-black"
                            style={{ color: "#e04040", opacity: 0.7 }}
                        >
                            ♥
                        </span>
                        <span
                            className="absolute -bottom-2 -right-1.5 text-sm font-black"
                            style={{ color: "#e04040", opacity: 0.7 }}
                        >
                            ♦
                        </span>
                        <span
                            className="absolute -bottom-2 -left-1.5 text-sm font-black"
                            style={{ color: "#f5c516", opacity: 0.7 }}
                        >
                            ♣
                        </span>
                    </div>

                    <h1
                        className="text-4xl xl:text-5xl font-black tracking-tight"
                        style={{ color: "#faf2e2" }}
                    >
                        {tHome("title")}
                    </h1>
                    <p
                        className="mt-2 text-sm font-semibold"
                        style={{ color: "#9a8870" }}
                    >
                        {tHome("subtitle")}
                    </p>
                </div>

                <div className="flex items-center gap-3 mb-6">
                    <div
                        className="h-px flex-1"
                        style={{ background: "#3d2d18" }}
                    />
                    <span
                        className="text-xs font-bold uppercase tracking-widest"
                        style={{ color: "#7a6a50" }}
                    >
                        {tAuth("login.title")}
                    </span>
                    <div
                        className="h-px flex-1"
                        style={{ background: "#3d2d18" }}
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
                    className="mt-10 text-center text-xs font-semibold"
                    style={{ color: "#7a6a50" }}
                >
                    ♠ {tHome("title")} ♠
                </p>
            </div>
        </div>
    );
}
