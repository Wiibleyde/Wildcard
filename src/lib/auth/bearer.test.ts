import { beforeEach, describe, expect, it, vi } from "vitest";

const ISS = "https://supabase.wiibleyde.dev";

interface FakeAuth {
    claims: Record<string, unknown> | null;
    claimsError: boolean;
    userError: { status: number } | null;
    getUserCalls: number;
}

const fake: FakeAuth = {
    claims: null,
    claimsError: false,
    userError: null,
    getUserCalls: 0,
};

vi.mock("@/lib/supabase/env", () => ({
    getSupabaseEnv: () => ({ url: ISS, anonKey: "anon" }),
}));

vi.mock("@/lib/supabase/server", () => ({
    createTokenClient: () => ({
        auth: {
            getClaims: async () =>
                fake.claimsError
                    ? { data: null, error: new Error("bad signature") }
                    : { data: { claims: fake.claims }, error: null },
            getUser: async () => {
                fake.getUserCalls++;
                return { data: {}, error: fake.userError };
            },
        },
    }),
}));

const { bearerToken, verifyBearer } = await import("./bearer");

function req(auth?: string): Request {
    return new Request("https://wildcard.wiibleyde.dev/api/rooms", {
        method: "POST",
        headers: auth ? { authorization: auth } : {},
    });
}

let sessionSeq = 0;
function validClaims(overrides: Record<string, unknown> = {}) {
    sessionSeq++;
    return {
        sub: "user-1",
        email: "a@b.c",
        iss: ISS,
        aud: "authenticated",
        exp: Math.floor(Date.now() / 1000) + 3600,
        session_id: `session-${sessionSeq}`,
        ...overrides,
    };
}

beforeEach(() => {
    fake.claims = validClaims();
    fake.claimsError = false;
    fake.userError = null;
    fake.getUserCalls = 0;
});

describe("bearerToken", () => {
    it("reads only an Authorization: Bearer header", () => {
        expect(bearerToken(req("Bearer abc.def"))).toBe("abc.def");
        expect(bearerToken(req("bearer abc"))).toBe("abc");
        expect(bearerToken(req("Basic abc"))).toBeNull();
        expect(bearerToken(req())).toBeNull();
    });

    it("ignores the session cookie entirely", () => {
        const r = new Request("https://wildcard.wiibleyde.dev/api/rooms", {
            headers: { cookie: "sb-supabase-auth-token=whatever" },
        });
        expect(bearerToken(r)).toBeNull();
    });
});

describe("verifyBearer", () => {
    it("accepts a valid, live token", async () => {
        const result = await verifyBearer(req("Bearer t"));
        expect(result.ok).toBe(true);
        if (result.ok)
            expect(result.user).toEqual({ id: "user-1", email: "a@b.c" });
    });

    it("refuses a request without a token", async () => {
        expect(await verifyBearer(req())).toEqual({
            ok: false,
            error: "unauthorized",
        });
    });

    it("refuses a bad signature", async () => {
        fake.claimsError = true;
        expect(await verifyBearer(req("Bearer t"))).toMatchObject({
            error: "unauthorized",
        });
    });

    it("refuses a foreign issuer or audience", async () => {
        fake.claims = validClaims({ iss: "https://evil.example" });
        expect(await verifyBearer(req("Bearer t"))).toMatchObject({
            error: "unauthorized",
        });
        fake.claims = validClaims({ aud: ["anon"] });
        expect(await verifyBearer(req("Bearer t"))).toMatchObject({
            error: "unauthorized",
        });
    });

    it("accepts the local CLI issuer form (<url>/auth/v1)", async () => {
        fake.claims = validClaims({ iss: `${ISS}/auth/v1` });
        expect((await verifyBearer(req("Bearer t"))).ok).toBe(true);
    });

    it("tells an expired token apart, so the client refreshes", async () => {
        fake.claims = validClaims({ exp: Math.floor(Date.now() / 1000) - 1 });
        expect(await verifyBearer(req("Bearer t"))).toMatchObject({
            error: "token_expired",
        });
    });

    it("refuses a signed-out session (valid signature, dead session)", async () => {
        fake.userError = { status: 403 };
        expect(await verifyBearer(req("Bearer t"))).toMatchObject({
            error: "session_revoked",
        });
    });

    it("fails open when GoTrue is down", async () => {
        fake.userError = { status: 503 };
        expect((await verifyBearer(req("Bearer t"))).ok).toBe(true);
    });

    it("caches liveness per session for a few seconds", async () => {
        await verifyBearer(req("Bearer t"));
        await verifyBearer(req("Bearer t"));
        expect(fake.getUserCalls).toBe(1);
    });
});
