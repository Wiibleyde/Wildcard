"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { linkIdentity, type OAuthProvider } from "@/lib/supabase/auth";

export function useOAuthLinking() {
    const params = useParams();
    const lang = (params?.lang as string) ?? "fr";
    const [linking, setLinking] = useState<OAuthProvider | null>(null);

    async function handleLink(provider: OAuthProvider) {
        setLinking(provider);
        await linkIdentity(provider, lang);
    }

    return { linking, handleLink };
}
