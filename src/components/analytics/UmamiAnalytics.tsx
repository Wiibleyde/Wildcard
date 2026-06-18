import Script from "next/script";
import { readPublicEnvFromProcess } from "@/lib/public-env";

/**
 * Self-hosted Umami analytics tag.
 *
 * Umami is **cookieless** and stores no personal data — it hashes IP + user
 * agent per day into an anonymous visitor id, so there is no consent banner to
 * show (RGPD-compliant by design). We own the data: it lives in our own
 * `umami-db` Postgres (see docker-compose `monitoring` profile), never a third
 * party.
 *
 * Renders nothing unless both env vars are set, so local/dev runs without the
 * monitoring stack stay clean. Server component → reads runtime env, so the
 * Umami URL/ID are configured at container start, not baked at build.
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
