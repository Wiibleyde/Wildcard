"use client";

import type { PublicEnv } from "@/lib/public-env";

/**
 * Publishes runtime env to `window.__PUBLIC_ENV__` during its own render —
 * synchronously, before deeper client components (it's the first child of
 * `<body>`; React renders top-down) so consumers like the browser Supabase
 * client see it. Renders `null` rather than an inline `<script>`, which would
 * trip React 19's "script tag while rendering" warning on every re-render
 * (locale switch, etc.). The window assignment is idempotent, so Strict-Mode's
 * double render is harmless.
 */
export function EnvBootstrap({ env }: { env: PublicEnv }) {
    if (typeof window !== "undefined") {
        window.__PUBLIC_ENV__ = env;
    }
    return null;
}
