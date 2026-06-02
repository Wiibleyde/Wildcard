import { redirect } from "next/navigation";
import { OAuthButton } from "@/components/auth/OAuthButton";
import { getDictionary } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";

export async function LoginPage({ lang }: { lang: string }) {
  const dict = await getDictionary(lang);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect(`/${lang}`);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-sm lg:max-w-md xl:max-w-lg">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 mb-5">
            <svg
              viewBox="0 0 24 24"
              className="w-8 h-8 text-white"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"
              />
            </svg>
          </div>
          <h1 className="text-2xl xl:text-3xl font-bold text-white">
            {dict.auth.login.title}
          </h1>
          <p className="text-gray-400 mt-2 text-sm">
            {dict.auth.login.subtitle}
          </p>
        </div>

        <div className="space-y-3">
          <OAuthButton
            provider="google"
            labelOverride={dict.auth.login.with_google}
          />
          <OAuthButton
            provider="discord"
            labelOverride={dict.auth.login.with_discord}
          />
          <OAuthButton
            provider="apple"
            labelOverride={dict.auth.login.with_apple}
          />
        </div>

        <p className="mt-8 text-center text-xs text-gray-500">
          {dict.home.title} &mdash; {dict.home.subtitle}
        </p>
      </div>
    </div>
  );
}
