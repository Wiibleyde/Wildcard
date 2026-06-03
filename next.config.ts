import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
    output: "standalone",
    reactCompiler: true,
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
