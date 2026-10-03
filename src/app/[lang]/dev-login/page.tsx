import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { Input } from "@/components/ui/base/input";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { fieldClass } from "@/components/ui/fields";
import { GameButton } from "@/components/ui/GameButton";
import { devSignIn } from "./actions";

/** Accounts created by supabase/seed.sql (password: password123). */
const SEEDED = [
    { email: "dev@local.test", label: "dev — admin" },
    { email: "player@local.test", label: "player — joueur" },
] as const;

// Dev-only stand-in for the portal login (404 in production builds): not translated on purpose.
export const metadata: Metadata = { title: "Dev login" };

export default async function Page({
    params,
    searchParams,
}: {
    params: Promise<{ lang: Locale }>;
    searchParams: Promise<{ next?: string; error?: string }>;
}) {
    if (process.env.NODE_ENV !== "development") notFound();
    const { lang } = await params;
    setRequestLocale(lang);
    const { next = `/${lang}`, error } = await searchParams;

    return (
        <div className="min-h-screen px-4 xl:px-10 pt-10 pb-16">
            <div className="max-w-lg mx-auto panel-d p-6 flex flex-col gap-5">
                <div>
                    <span
                        className="stamp"
                        style={{
                            background: "var(--gold)",
                            color: "var(--ink)",
                        }}
                    >
                        Dev login
                    </span>
                    <p
                        className="text-sm font-semibold mt-3"
                        style={{ color: "var(--muted)" }}
                    >
                        En prod, la connexion passe par le portal
                        auth.wiibleyde.dev. Ici, connexion directe par email /
                        mot de passe.
                    </p>
                </div>

                {error && <ErrorBanner>{error}</ErrorBanner>}

                <div className="flex flex-col gap-2">
                    {SEEDED.map((account) => (
                        <form key={account.email} action={devSignIn}>
                            <input type="hidden" name="lang" value={lang} />
                            <input type="hidden" name="next" value={next} />
                            <input
                                type="hidden"
                                name="email"
                                value={account.email}
                            />
                            <input
                                type="hidden"
                                name="password"
                                value="password123"
                            />
                            <GameButton
                                type="submit"
                                variant="cream"
                                size="sm"
                                className="w-full"
                            >
                                {account.label}
                            </GameButton>
                        </form>
                    ))}
                </div>

                <form action={devSignIn} className="flex flex-col gap-2">
                    <input type="hidden" name="lang" value={lang} />
                    <input type="hidden" name="next" value={next} />
                    <Input
                        name="email"
                        type="email"
                        required
                        placeholder="email"
                        className={fieldClass}
                    />
                    <Input
                        name="password"
                        type="password"
                        required
                        placeholder="mot de passe"
                        className={fieldClass}
                    />
                    <GameButton type="submit" size="sm">
                        Se connecter
                    </GameButton>
                </form>
            </div>
        </div>
    );
}
