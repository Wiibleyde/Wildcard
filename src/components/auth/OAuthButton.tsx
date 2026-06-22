"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { useButtonPress } from "@/hooks/useButtonPress";
import { type OAuthProvider, signInWithOAuth } from "@/lib/supabase/auth";
import { DiscordIcon, GoogleIcon } from "./ProviderIcons";

type ProviderConfig = {
    label: string;
    icon: React.ReactNode;
    bg: string;
    text: string;
    border: string;
    shadow: string;
};

const providers: Record<OAuthProvider, ProviderConfig> = {
    google: {
        label: "Google",
        bg: "#ffffff",
        text: "#1a1a1a",
        border: "#d0d0d0",
        shadow: "#a0a0a0",
        icon: <GoogleIcon />,
    },
    discord: {
        label: "Discord",
        bg: "#5865F2",
        text: "#ffffff",
        border: "#4555e8",
        shadow: "#3040c0",
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
    const { pressed, handlers } = useButtonPress();
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
            {...handlers}
            className="w-full flex items-center justify-center gap-3 px-5 py-4 rounded-xl font-bold text-sm cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            style={{
                background: cfg.bg,
                color: cfg.text,
                border: `2px solid ${cfg.border}`,
                transform:
                    pressed && !loading ? "translateY(3px)" : "translateY(0)",
                boxShadow:
                    pressed || loading ? "none" : `0 4px 0 0 ${cfg.shadow}`,
                transition: "transform 80ms ease, box-shadow 80ms ease",
            }}
        >
            {cfg.icon}
            <span>{labelOverride ?? cfg.label}</span>
        </button>
    );
}
