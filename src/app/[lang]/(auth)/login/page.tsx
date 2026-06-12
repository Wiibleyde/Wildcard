import type { Locale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { LoginPage } from "@/components/pages/LoginPage";

export default async function Page({
    params,
}: {
    params: Promise<{ lang: Locale }>;
}) {
    const { lang } = await params;
    setRequestLocale(lang);
    return <LoginPage lang={lang} />;
}
