import { describe, expect, it } from "vitest";
import { buildCsp, generateNonce } from "./csp";

const PROD = {
    supabaseUrl: "https://supabase.wiibleyde.dev",
    portalUrl: "https://auth.wiibleyde.dev",
    umamiUrl: "https://umami.wiibleyde.dev/",
    dev: false,
};

function directive(csp: string, name: string): string {
    return csp.split("; ").find((d) => d.startsWith(`${name} `)) ?? "";
}

describe("buildCsp", () => {
    it("never allows inline script, only the request nonce", () => {
        const csp = buildCsp("abc", PROD);
        const script = directive(csp, "script-src");
        expect(script).toContain("'nonce-abc'");
        expect(script).toContain("'strict-dynamic'");
        expect(script).not.toContain("'unsafe-inline'");
        expect(script).not.toContain("'unsafe-eval'");
    });

    it("lets the access token reach only the app, Supabase, the portal and Umami", () => {
        const connect = directive(buildCsp("n", PROD), "connect-src");
        expect(connect.split(" ").slice(1)).toEqual([
            "'self'",
            "https://supabase.wiibleyde.dev",
            "wss://supabase.wiibleyde.dev",
            "https://auth.wiibleyde.dev",
            "https://umami.wiibleyde.dev",
        ]);
    });

    it("forbids framing and upgrades mixed content in production", () => {
        const csp = buildCsp("n", PROD);
        expect(csp).toContain("frame-ancestors 'none'");
        expect(csp).toContain("upgrade-insecure-requests");
        expect(csp).toContain("object-src 'none'");
    });

    it("relaxes only what next dev needs", () => {
        const csp = buildCsp("n", {
            supabaseUrl: "http://127.0.0.1:54321",
            portalUrl: "",
            umamiUrl: "",
            dev: true,
        });
        expect(directive(csp, "script-src")).toContain("'unsafe-eval'");
        expect(directive(csp, "connect-src")).toContain("ws://127.0.0.1:54321");
        expect(csp).not.toContain("upgrade-insecure-requests");
    });

    it("ignores unset or malformed origins", () => {
        const csp = buildCsp("n", {
            supabaseUrl: "not a url",
            portalUrl: "",
            umamiUrl: "",
            dev: false,
        });
        expect(directive(csp, "connect-src")).toBe("connect-src 'self'");
    });
});

describe("generateNonce", () => {
    it("is fresh on every call", () => {
        expect(generateNonce()).not.toBe(generateNonce());
        expect(generateNonce()).toMatch(/^[A-Za-z0-9+/]{22}==$/);
    });
});
