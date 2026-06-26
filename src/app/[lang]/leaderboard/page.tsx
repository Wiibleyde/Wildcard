import type { Locale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { LeaderboardPage } from "@/components/pages/LeaderboardPage";

export default async function Page({
    params,
}: {
    params: Promise<{ lang: Locale }>;
}) {
    const { lang } = await params;
    setRequestLocale(lang);
    return <LeaderboardPage />;
}
