import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { LinkedAccounts } from "@/components/profile/LinkedAccounts";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { getDictionary } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export async function ProfilePage({ lang }: { lang: string }) {
  const dict = await getDictionary(lang);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${lang}/login`);

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const profile = data as Profile | null;
  const linkedProviders = (user.identities ?? []).map((i) => i.provider);

  const memberSince = new Date(user.created_at).toLocaleDateString(
    lang === "fr" ? "fr-FR" : "en-US",
    { year: "numeric", month: "long" },
  );

  return (
    <div className="min-h-screen bg-gray-950 px-4 py-12">
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-xl font-bold text-white">{dict.profile.title}</h1>
          <SignOutButton label={dict.profile.sign_out} />
        </div>

        <div className="bg-gray-900 rounded-2xl p-6 mb-4 border border-gray-800">
          <ProfileForm
            userId={user.id}
            initialUsername={profile?.username ?? ""}
            initialAvatarPath={profile?.avatar_url ?? null}
            dict={dict}
          />
        </div>

        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">
            {dict.profile.linked_accounts}
          </h2>
          <LinkedAccounts linkedProviders={linkedProviders} dict={dict} />
        </div>

        <p className="text-center text-xs text-gray-600 mt-6">
          {dict.profile.member_since} {memberSince}
        </p>
      </div>
    </div>
  );
}
