"use client";

import type { PublicEnv } from "@/lib/public-env";

/**
 * Publishes the server-provided runtime env to `window.__PUBLIC_ENV__` during
 * its own render — synchronously, so it is set before any deeper client
 * component renders (this is the first child of `<body>`, and React renders the
 * tree top-down). That ordering matters: consumers like the browser Supabase
 * client call {@link publicEnv} inside their own render, which runs after this.
 *
 * Renders `null` — no DOM node at all — which is the point: an inline `<script>`
 * here would trip React 19's "Encountered a script tag while rendering" warning
 * on every client re-render (e.g. a locale switch re-rendering the root layout),
 * since inline scripts never re-execute on the client. Assigning a window global
 * is idempotent, so the Strict-Mode double render is harmless.
 */
export function EnvBootstrap({ env }: { env: PublicEnv }) {
    if (typeof window !== "undefined") {
        window.__PUBLIC_ENV__ = env;
    }
    return null;
}
