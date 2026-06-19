import type { Metadata } from "next";
import { Nunito } from "next/font/google";
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

const nunito = Nunito({
    variable: "--font-nunito",
    subsets: ["latin"],
    weight: ["400", "600", "700", "800", "900"],
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
        <html lang={lang} className={`${nunito.variable} h-full antialiased`}>
            <body className="min-h-screen bg-wc-surface text-wc-text">
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
