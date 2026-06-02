import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "../globals.css";
import { AppNav } from "@/components/nav/AppNav";
import { defaultLocale, getDictionary, type Locale, locales } from "@/lib/i18n";
import { I18nProvider } from "@/lib/i18n/context";

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
  return locales.map((lang) => ({ lang }));
}

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}>) {
  const { lang } = await params;
  const locale = (
    locales.includes(lang as Locale) ? lang : defaultLocale
  ) as Locale;
  const dict = await getDictionary(locale);

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-screen bg-wc-surface text-wc-text">
        <I18nProvider locale={locale} dict={dict}>
          <AppNav lang={locale} />
          <div className="md:pl-[220px] pb-[60px] md:pb-0">{children}</div>
        </I18nProvider>
      </body>
    </html>
  );
}
