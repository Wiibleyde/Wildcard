import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { fieldClass, fieldStyle } from "@/components/studio/fields";
import { devSignIn } from "./actions";

/** Accounts created by supabase/seed.sql (password: password123). */
const SEEDED = [
    { email: "dev@local.test", label: "dev — admin" },
    { email: "player@local.test", label: "player — joueur" },
] as const;

/**
 * Local stand-in for the portal login (auth.wiibleyde.dev), reachable only
 * under `next dev`: production builds answer 404. Seeded accounts sign in in
 * one click; the form also takes a real account of the shared stack when
 * running `bun run dev:shared`. Dev tool — not translated on purpose.
 */
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

                {error && (
                    <p
                        className="text-sm font-semibold"
                        style={{ color: "var(--red)" }}
                    >
                        {error}
                    </p>
                )}

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
                            <button
                                type="submit"
                                className="wc-btn w-full px-4 py-2 text-sm"
                                style={{
                                    background: "var(--cream)",
                                    color: "var(--ink)",
                                }}
                            >
                                {account.label}
                            </button>
                        </form>
                    ))}
                </div>

                <form action={devSignIn} className="flex flex-col gap-2">
                    <input type="hidden" name="lang" value={lang} />
                    <input type="hidden" name="next" value={next} />
                    <input
                        name="email"
                        type="email"
                        required
                        placeholder="email"
                        className={fieldClass}
                        style={fieldStyle}
                    />
                    <input
                        name="password"
                        type="password"
                        required
                        placeholder="mot de passe"
                        className={fieldClass}
                        style={fieldStyle}
                    />
                    <button
                        type="submit"
                        className="wc-btn px-4 py-2 text-sm"
                        style={{
                            background: "var(--gold)",
                            color: "var(--ink)",
                        }}
                    >
                        Se connecter
                    </button>
                </form>
            </div>
        </div>
    );
}
