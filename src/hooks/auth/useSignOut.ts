"use client";

import { useRouter } from "@/i18n/navigation";
import { signOut } from "@/lib/supabase/auth";

/**
 * Single sign-out flow shared by every "log out" control: end the shared
 * portal session, then land on the localized home page. The next-intl router
 * prefixes the current locale itself, so no `params.lang` cast is needed.
 */
export function useSignOut(): () => Promise<void> {
    const router = useRouter();

    return async function handleSignOut() {
        await signOut();
        router.push("/");
        router.refresh();
    };
}
