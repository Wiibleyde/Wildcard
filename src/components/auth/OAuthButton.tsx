"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { type OAuthProvider, signInWithOAuth } from "@/lib/supabase/auth";
import { DiscordIcon, GoogleIcon } from "./ProviderIcons";

type ProviderConfig = {
    label: string;
    icon: React.ReactNode;
    /** Fill of the chunky button — provider color or cream. */
    bg: string;
    /** Label/icon color against the fill. */
    text: string;
};

// Neobrutalism OAuth buttons — provider fill, thick ink outline + hard ink
// shadow (from `.wc-btn`), Lilita label. Provider brand color stays; the
// signature ink border/shadow replaces the soft provider-tinted shadow.
const providers: Record<OAuthProvider, ProviderConfig> = {
    google: {
        label: "Google",
        bg: "var(--cream)",
        text: "var(--ink)",
        icon: <GoogleIcon />,
    },
    discord: {
        label: "Discord",
        bg: "#5865F2",
        text: "var(--accent-ink)",
        icon: <DiscordIcon />,
    },
};

export function OAuthButton({
    provider,
    labelOverride,
}: {
    provider: OAuthProvider;
    labelOverride?: string;
}) {
    const params = useParams();
    const lang = (params?.lang as string) ?? "fr";
    const [loading, setLoading] = useState(false);
    const cfg = providers[provider];

    async function handleClick() {
        setLoading(true);
        await signInWithOAuth(provider, lang);
    }

    return (
        <button
            type="button"
            onClick={handleClick}
            disabled={loading}
            className="wc-btn w-full px-5 py-4 text-base"
            style={{ background: cfg.bg, color: cfg.text }}
        >
            {cfg.icon}
            <span>{labelOverride ?? cfg.label}</span>
        </button>
    );
}
