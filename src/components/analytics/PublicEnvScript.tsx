import { readPublicEnvFromProcess } from "@/lib/public-env";

/**
 * Injects the runtime public env as `window.__PUBLIC_ENV__` before any client
 * code runs. Rendered as the first node in `<body>`: a plain inline script
 * executes during HTML parse, ahead of React hydration, so the browser
 * Supabase client and the Umami tag both see the values.
 *
 * Server component → reads live `process.env` at request time (not baked).
 * Carries only public-safe values; never the service-role key.
 */
export function PublicEnvScript() {
    const env = readPublicEnvFromProcess();
    // Escape `<` so a value can never break out of the script tag.
    const json = JSON.stringify(env).replace(/</g, "\\u003c");
    return (
        <script
            id="__PUBLIC_ENV__"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: serialized, escaped, server-controlled public config (no secrets)
            dangerouslySetInnerHTML={{
                __html: `window.__PUBLIC_ENV__=${json}`,
            }}
        />
    );
}
