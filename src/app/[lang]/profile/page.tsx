import { setRequestLocale } from "next-intl/server";
import { ProfilePage } from "@/components/pages/ProfilePage";

export default async function Page({
    params,
}: {
    params: Promise<{ lang: string }>;
}) {
    const { lang } = await params;
    setRequestLocale(lang);
    return <ProfilePage lang={lang} />;
}
