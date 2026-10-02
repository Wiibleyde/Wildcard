"use client";

import { useRouter } from "@/i18n/navigation";
import { signOut } from "@/lib/supabase/auth";

export function useSignOut(): () => Promise<void> {
    const router = useRouter();

    return async function handleSignOut() {
        await signOut();
        router.push("/");
        router.refresh();
    };
}
