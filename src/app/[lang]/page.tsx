import { getDictionary } from "@/lib/i18n";

export default async function Home({
    params,
}: {
    params: Promise<{ lang: string }>;
}) {
    const { lang } = await params;
    const dict = await getDictionary(lang);

    return (
        <div>
            <h1>{dict.home.title}</h1>
            <p>{dict.home.subtitle}</p>
        </div>
    );
}
