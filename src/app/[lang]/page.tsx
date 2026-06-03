import { getTranslations, setRequestLocale } from "next-intl/server";

export default async function Home({
    params,
}: {
    params: Promise<{ lang: string }>;
}) {
    const { lang } = await params;
    setRequestLocale(lang);
    const t = await getTranslations("home");

    return (
        <div>
            <h1>{t("title")}</h1>
            <p>{t("subtitle")}</p>
        </div>
    );
}
