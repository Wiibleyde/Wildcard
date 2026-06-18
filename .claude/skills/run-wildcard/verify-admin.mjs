#!/usr/bin/env node
// Ad-hoc verification for the admin/moderator module. Reuses the run-wildcard
// auth pattern (admin-create a confirmed user, password-grant, forge the
// @supabase/ssr cookie). Drives:
//   1. admin opens /fr/admin (dashboard + maintenance control) — screenshot
//   2. admin enables maintenance via the API
//   3. a NON-admin navigating any page is rewritten to /maintenance — screenshot
//   4. the admin still gets through during maintenance
//   5. maintenance disabled again; non-admin restored
//   6. role gate: non-admin hitting /fr/admin is redirected home
//   7. API guard: non-admin POST /api/admin/maintenance -> 403
import { mkdirSync, readFileSync } from "node:fs";
import { createServerClient } from "@supabase/ssr";
import { chromium } from "playwright";

const ROOT = new URL("../../../", import.meta.url).pathname;
const BASE = "http://localhost:3000";
const SHOTS = `${ROOT}.uitest/shots/`;
mkdirSync(SHOTS, { recursive: true });

const env = Object.fromEntries(
    readFileSync(`${ROOT}.env.local`, "utf8")
        .split("\n")
        .filter((l) => l.includes("=") && !l.startsWith("#"))
        .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const SB = env.SUPABASE_URL;

async function authCookies(email, password, username) {
    await fetch(`${SB}/auth/v1/admin/users`, {
        method: "POST",
        headers: {
            apikey: env.SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            email,
            password,
            email_confirm: true,
            user_metadata: { username },
        }),
    });
    const res = await fetch(`${SB}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: { apikey: env.SUPABASE_ANON_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error(`login ${res.status}: ${await res.text()}`);
    const session = await res.json();
    let captured = [];
    const sb = createServerClient(SB, env.SUPABASE_ANON_KEY, {
        cookies: { getAll: () => [], setAll: (cs) => { captured = cs; } },
    });
    const { error } = await sb.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
    });
    if (error) throw new Error(`setSession: ${error.message}`);
    return captured.map((c) => ({
        name: c.name, value: c.value, domain: "localhost", path: "/",
    }));
}

const report = {};
const browser = await chromium.launch({ args: ["--no-sandbox"] });

// ── Admin context (ui-test was promoted to admin in the DB) ──
const adminCtx = await browser.newContext();
await adminCtx.addCookies(
    await authCookies("ui-test@wildcard.local", "ui-test-password-1234", "Testeur"),
);

// Seed one live game so the dashboard isn't empty.
async function apost(ctx, path, data) {
    const res = await ctx.request.post(`${BASE}${path}`, data ? { data } : {});
    return { status: res.status(), body: await res.json().catch(() => ({})) };
}
// VISIBLE text only — page.content() embeds the whole i18n dictionary (via
// NextIntlClientProvider), so every page "contains" every translated string.
const visible = (page) => page.evaluate(() => document.body.innerText);
const room = await apost(adminCtx, "/api/rooms", { moduleId: "president" });
await apost(adminCtx, `/api/rooms/${room.body.code}/bots`, { count: 3 });
await apost(adminCtx, `/api/rooms/${room.body.code}/start`);

const adminPage = await adminCtx.newPage();
await adminPage.setViewportSize({ width: 1920, height: 1080 });
await adminPage.goto(`${BASE}/fr/admin`, { waitUntil: "load", timeout: 45000 });
await adminPage.waitForTimeout(1500);
report.adminDashboard = {
    url: adminPage.url(),
    visibleText: ((await visible(adminPage)) || "").slice(0, 160).replace(/\s+/g, " "),
};
await adminPage.screenshot({ path: `${SHOTS}admin-1920.png`, fullPage: true });
await adminPage.setViewportSize({ width: 375, height: 812 });
await adminPage.goto(`${BASE}/fr/admin`, { waitUntil: "load", timeout: 45000 });
await adminPage.waitForTimeout(1200);
await adminPage.screenshot({ path: `${SHOTS}admin-375.png`, fullPage: true });

// ── Enable maintenance via the API (admin) ──
report.enableMaintenance = await apost(adminCtx, "/api/admin/maintenance", {
    maintenance: true,
    message: "Maintenance de test — retour dans quelques minutes.",
});

// ── Non-admin context ──
const nonCtx = await browser.newContext();
await nonCtx.addCookies(
    await authCookies("ui-nonadmin@wildcard.local", "ui-nonadmin-pw-1234", "Lambda"),
);
const nonPage = await nonCtx.newPage();
await nonPage.setViewportSize({ width: 1280, height: 800 });
await nonPage.goto(`${BASE}/fr/lobby`, { waitUntil: "load", timeout: 45000 });
await nonPage.waitForTimeout(1000);
const nonText = (await visible(nonPage)) || "";
report.nonAdminLockedOut = {
    url: nonPage.url(),
    showsMaintenance: nonText.includes("Maintenance en cours"),
    showsCustomMessage: nonText.includes("retour dans quelques minutes"),
};
await nonPage.screenshot({ path: `${SHOTS}maintenance-1280.png`, fullPage: true });

// ── Admin still gets through during maintenance ──
await adminPage.setViewportSize({ width: 1280, height: 800 });
await adminPage.goto(`${BASE}/fr/admin`, { waitUntil: "load", timeout: 45000 });
await adminPage.waitForTimeout(800);
report.adminBypassesMaintenance = {
    url: adminPage.url(),
    stillAdmin: ((await visible(adminPage)) || "").includes("Administration"),
    notMaintenance: !((await visible(adminPage)) || "").includes("Maintenance en cours"),
};

// ── API guard: non-admin cannot toggle ──
report.nonAdminApi403 = (
    await apost(nonCtx, "/api/admin/maintenance", { maintenance: false })
).status;

// ── Disable maintenance again ──
report.disableMaintenance = await apost(adminCtx, "/api/admin/maintenance", {
    maintenance: false,
});

// ── Non-admin restored, but role gate redirects /admin -> home ──
// Cache-bust: Chromium may reuse the prior same-URL maintenance document.
await nonPage.goto(`${BASE}/fr/lobby?_=${Date.now()}`, { waitUntil: "load", timeout: 45000 });
await nonPage.waitForTimeout(800);
report.nonAdminRestored = {
    url: nonPage.url(),
    maintenanceGone: !((await visible(nonPage)) || "").includes("Maintenance en cours"),
};
await nonPage.goto(`${BASE}/fr/admin`, { waitUntil: "load", timeout: 45000 });
await nonPage.waitForTimeout(800);
report.roleGateRedirect = { finalUrl: nonPage.url() };

console.log(JSON.stringify(report, null, 1));
await browser.close();
