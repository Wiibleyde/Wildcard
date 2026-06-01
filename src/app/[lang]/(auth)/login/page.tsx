import { LoginPage } from "@/components/pages/LoginPage";

export default async function Page({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  return <LoginPage lang={lang} />;
}
