import { headers } from "next/headers";
import Script from "next/script";
import { readPublicEnvFromProcess } from "@/lib/public-env";

/**
 * Self-hosted Umami tag. Cookieless and stores no personal data (RGPD-compliant
 * by design), data lives in our own `umami-db`. Renders nothing unless both env
 * vars are set; reads runtime env so the URL/ID are configured at container
 * start, not baked at build.
 */
export async function UmamiAnalytics() {
    const { UMAMI_URL: src, UMAMI_WEBSITE_ID: websiteId } =
        readPublicEnvFromProcess();
    if (!src || !websiteId) return null;
    // CSP nonce of this request (proxy.ts). `strict-dynamic` would already
    // trust a script injected by Next's own nonced runtime; the explicit nonce
    // keeps the tag working whatever strategy it is loaded with.
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
