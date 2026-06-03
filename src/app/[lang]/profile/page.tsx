import { ProfilePage } from "@/components/pages/ProfilePage";

export default async function Page({
    params,
}: {
    params: Promise<{ lang: string }>;
}) {
    const { lang } = await params;
    return <ProfilePage lang={lang} />;
}
