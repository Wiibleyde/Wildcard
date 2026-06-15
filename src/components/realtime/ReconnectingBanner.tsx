"use client";

import { useTranslations } from "next-intl";
import type { RealtimeStatus } from "@/lib/realtime/useRealtimeSync";

/**
 * Thin "you may be out of sync" notice driven by a Realtime channel's health.
 * Renders only while reconnecting after a drop — the first `connecting` join is
 * silent to avoid a banner flashing on every page load. Once the socket
 * re-`SUBSCRIBED`s, the hook resyncs state and this disappears.
 */
export function ReconnectingBanner({ status }: { status: RealtimeStatus }) {
    const t = useTranslations("realtime");
    if (status !== "reconnecting") return null;

    return (
        <output
            aria-live="polite"
            className="mx-auto flex w-full max-w-3xl items-center justify-center gap-2 rounded-xl border border-wc-gold/40 bg-wc-gold-dim px-4 py-2 text-center text-sm font-bold text-wc-gold xl:max-w-5xl 2xl:max-w-7xl"
        >
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-wc-gold" />
            {t("reconnecting")}
        </output>
    );
}
