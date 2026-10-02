"use client";

import type { PublicEnv } from "@/lib/public-env";

/**
 * Assigns `window.__PUBLIC_ENV__` during render: as the first child of <body>
 * it runs before any consumer. No inline <script>: React 19 warns on each re-render.
 */
export function EnvBootstrap({ env }: { env: PublicEnv }) {
    if (typeof window !== "undefined") {
        window.__PUBLIC_ENV__ = env;
    }
    return null;
}
