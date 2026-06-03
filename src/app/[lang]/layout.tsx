import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import "../globals.css";
import { AppNav } from "@/components/nav/AppNav";
import { routing } from "@/i18n/routing";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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

  // Exposes locale to all Server Components in this tree via React cache
  setRequestLocale(lang);

  return (
    <html
      lang={lang}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-screen bg-wc-surface text-wc-text">
        {/* NextIntlClientProvider reads messages from getRequestConfig — no props needed */}
        <NextIntlClientProvider>
          <AppNav />
          <div className="md:pl-55 xl:pl-64 pb-15 md:pb-0">{children}</div>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
