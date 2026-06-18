import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
    output: "standalone",
    reactCompiler: true,
    // prom-client probes Node internals (perf_hooks, GC) — keep it external so
    // the bundler doesn't tree-shake or wrap it; it must run as plain CJS.
    serverExternalPackages: ["prom-client"],
    images: {
        dangerouslyAllowSVG: true,
        remotePatterns: [
            {
                protocol: "http",
                hostname: "localhost",
                port: "54321",
                pathname: "/**",
            },
        ],
        ...(process.env.NODE_ENV === "development" && { unoptimized: true }),
    },
};

export default withNextIntl(nextConfig);
