import { headers } from "next/headers";
import Script from "next/script";
import { readPublicEnvFromProcess } from "@/lib/public-env";

/** Self-hosted, cookieless Umami (no personal data). Renders nothing unless configured. */
export async function UmamiAnalytics() {
    const { UMAMI_URL: src, UMAMI_WEBSITE_ID: websiteId } =
        readPublicEnvFromProcess();
    if (!src || !websiteId) return null;
    // Explicit nonce: keeps the tag working whatever loading strategy Next picks.
    const nonce = (await headers()).get("x-nonce") ?? undefined;

    return (
        <Script
            src={`${src.replace(/\/$/, "")}/script.js`}
            data-website-id={websiteId}
            strategy="afterInteractive"
            nonce={nonce}
        />
    );
}
