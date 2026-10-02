import type { Metadata } from "next";
import { Hanken_Grotesk, Lilita_One, Silkscreen } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import "../globals.css";
import { PublicEnvScript } from "@/components/analytics/PublicEnvScript";
import { UmamiAnalytics } from "@/components/analytics/UmamiAnalytics";
import { AppNav } from "@/components/nav/AppNav";
import { AppShell } from "@/components/nav/AppShell";
import { GuestNav } from "@/components/nav/GuestNav";
import { ConfirmProvider } from "@/components/ui/ConfirmProvider";
import { routing } from "@/i18n/routing";
import { getAuthUser } from "@/lib/auth/session";

const body = Hanken_Grotesk({
    variable: "--font-body",
    subsets: ["latin"],
    weight: ["400", "500", "600", "700", "800"],
});

const display = Lilita_One({
    variable: "--font-display",
    subsets: ["latin"],
    weight: ["400"],
});

// Not `--font-pixel`: that name is the Tailwind theme token built on top of it.
const pixel = Silkscreen({
    variable: "--font-silkscreen",
    subsets: ["latin"],
    weight: ["400", "700"],
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
            className={`${body.variable} ${display.variable} ${pixel.variable} h-full antialiased`}
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
