import type { Metadata } from "next";
import { Hanken_Grotesk, Lilita_One, Silkscreen } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import "../globals.css";
import { PublicEnvScript } from "@/components/analytics/PublicEnvScript";
import { UmamiAnalytics } from "@/components/analytics/UmamiAnalytics";
import { AppNav } from "@/components/nav/AppNav";
import { AppShell } from "@/components/nav/AppShell";
import { GuestNav } from "@/components/nav/GuestNav";
import { ConfirmProvider } from "@/components/ui/ConfirmProvider";
import { routing } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";

// Body face — Hanken Grotesk: readable, slightly geometric, holds up at small
// sizes against the chunky display face.
const body = Hanken_Grotesk({
    variable: "--font-body",
    subsets: ["latin"],
    weight: ["400", "500", "600", "700", "800"],
});

// Display face — Lilita One: fat, rounded arcade poster type. Headings, brand,
// buttons, scores. The signature of the neobrutalism system.
const display = Lilita_One({
    variable: "--font-display",
    subsets: ["latin"],
    weight: ["400"],
});

// Pixel face — Silkscreen: tiny uppercase "stamp" labels (levels, meta chips).
const pixel = Silkscreen({
    variable: "--font-pixel",
    subsets: ["latin"],
    weight: ["400", "700"],
});

export const metadata: Metadata = {
    title: "Wildcard",
    description: "Plateforme de jeux de carte en ligne",
};

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

    const messages = await getMessages();

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    return (
        <html
            lang={lang}
            className={`${body.variable} ${display.variable} ${pixel.variable} h-full antialiased`}
        >
            <body className="min-h-screen bg-wc-bg text-wc-cream">
                <PublicEnvScript />
                <UmamiAnalytics />
                <NextIntlClientProvider locale={lang} messages={messages}>
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
