import Script from "next/script";
import { readPublicEnvFromProcess } from "@/lib/public-env";

/**
 * Self-hosted Umami tag. Cookieless and stores no personal data (RGPD-compliant
 * by design), data lives in our own `umami-db`. Renders nothing unless both env
 * vars are set; reads runtime env so the URL/ID are configured at container
 * start, not baked at build.
 */
export function UmamiAnalytics() {
    const { UMAMI_URL: src, UMAMI_WEBSITE_ID: websiteId } =
        readPublicEnvFromProcess();
    if (!src || !websiteId) return null;

    return (
        <Script
            src={`${src.replace(/\/$/, "")}/script.js`}
            data-website-id={websiteId}
            strategy="afterInteractive"
        />
    );
}
