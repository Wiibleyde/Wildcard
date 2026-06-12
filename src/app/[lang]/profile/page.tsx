import type { Locale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { ProfilePage } from "@/components/pages/ProfilePage";

export default async function Page({
    params,
}: {
    params: Promise<{ lang: Locale }>;
}) {
    const { lang } = await params;
    setRequestLocale(lang);
    return <ProfilePage lang={lang} />;
}
