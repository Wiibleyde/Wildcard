import type { Metadata } from "next";
import { Rubik, Titan_One } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import "../globals.css";
import { PublicEnvScript } from "@/components/analytics/PublicEnvScript";
import { UmamiAnalytics } from "@/components/analytics/UmamiAnalytics";
import { AppNav } from "@/components/layout/AppNav";
import { AppShell } from "@/components/layout/AppShell";
import { GuestNav } from "@/components/layout/GuestNav";
import { ConfirmProvider } from "@/components/ui/ConfirmProvider";
import { routing } from "@/i18n/routing";
import { getAuthUser } from "@/lib/auth/session";

const body = Rubik({
    variable: "--font-body",
    subsets: ["latin"],
    weight: ["400", "500", "600", "700", "800", "900"],
});

const display = Titan_One({
    variable: "--font-display",
    subsets: ["latin"],
    weight: ["400"],
});

export async function generateMetadata({
    params,
}: {
    params: Promise<{ lang: string }>;
}): Promise<Metadata> {
    const { lang } = await params;
    const locale = hasLocale(routing.locales, lang)
        ? lang
        : routing.defaultLocale;
    const t = await getTranslations({ locale, namespace: "home" });
    return {
        title: { default: t("title"), template: `%s · ${t("title")}` },
        description: t("subtitle"),
    };
}

export function generateStaticParams() {
    return routing.locales.map((lang) => ({ lang }));
}

export default async function RootLayout({
    children,
    params,
}: Readonly<{
    children: React.ReactNode;
    params: Promise<{ lang: string }>;
}>) {
    const { lang } = await params;
    if (!hasLocale(routing.locales, lang)) notFound();
    setRequestLocale(lang);

    const user = await getAuthUser();

    return (
        <html
            lang={lang}
            className={`${body.variable} ${display.variable} h-full antialiased`}
        >
            <body className="min-h-screen bg-wc-bg text-wc-cream">
                <PublicEnvScript />
                <UmamiAnalytics />
                {/* Server provider: inherits locale, messages and formats from i18n/request.ts. */}
                <NextIntlClientProvider>
                    <ConfirmProvider>
                        <AppShell
                            authed={!!user}
                            appNav={
                                user ? <AppNav user={user} /> : <GuestNav />
                            }
                        >
                            {children}
                        </AppShell>
                    </ConfirmProvider>
                </NextIntlClientProvider>
            </body>
        </html>
    );
}
