import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
    output: "standalone",
    // React Compiler runs through a Babel plugin. Under Turbopack dev it pegs
    // every core (runaway recompile, ~700% CPU even at idle), so we only enable
    // it for production builds — that's where the runtime memoization payoff
    // lands anyway. Dev keeps the fast Rust-only pipeline.
    reactCompiler: process.env.NODE_ENV === "production",
    // prom-client probes Node internals (perf_hooks, GC) — keep it external so
    // the bundler doesn't tree-shake or wrap it; it must run as plain CJS.
    serverExternalPackages: ["prom-client"],
    images: {
        dangerouslyAllowSVG: true,
        // Storage of the shared Supabase (portal avatars, ECA covers) and of the
        // local CLI stack.
        remotePatterns: [
            {
                protocol: "https",
                hostname: "supabase.wiibleyde.dev",
                pathname: "/storage/v1/**",
            },
            {
                protocol: "http",
                hostname: "127.0.0.1",
                port: "54321",
                pathname: "/storage/v1/**",
            },
            {
                protocol: "http",
                hostname: "localhost",
                port: "54321",
                pathname: "/storage/v1/**",
            },
        ],
        ...(process.env.NODE_ENV === "development" && { unoptimized: true }),
    },
};

export default withNextIntl(nextConfig);
