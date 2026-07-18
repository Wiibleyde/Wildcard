#!/usr/bin/env node
// Screenshot the new ECA surfaces: the play-hub Community section, the Studio
// hub (Play buttons), and an ECA game board at mobile (375) + 2K (2560).
import { mkdirSync, readFileSync } from "node:fs";
import { createServerClient } from "@supabase/ssr";
import { chromium } from "playwright";

const ROOT = new URL("../../../", import.meta.url).pathname;
const BASE = "http://localhost:3000";
const SHOTS = `${ROOT}.uitest/shots/`;
mkdirSync(SHOTS, { recursive: true });
const env = Object.fromEntries(readFileSync(`${ROOT}.env.local`, "utf8").split("\n").filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
const SB = env.SUPABASE_URL, SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const DEF = { version: 1, meta: { name: "Huit américain (démo)", minPlayers: 2, maxPlayers: 5 }, setup: { deckId: "french52", handSize: 7, startDiscard: true }, turn: { allowDraw: true, allowPass: true, passRequiresDraw: true, reshuffleDiscard: true }, rules: [{ id: "wild-eight", name: "8 — carte folle", event: "cardPlayed", conditions: [{ lhs: { kind: "card", source: "playedCard", prop: "rank" }, op: "eq", rhs: { kind: "literal", value: "8" } }], effects: [{ type: "acceptCard" }] }, { id: "same-suit", name: "Même couleur", event: "cardPlayed", conditions: [{ lhs: { kind: "card", source: "playedCard", prop: "suit" }, op: "eq", rhs: { kind: "card", source: "topDiscard", prop: "suit" } }], effects: [{ type: "acceptCard" }] }], win: { condition: "emptyHand" } };

async function auth() {
    const EMAIL = "ui-test@wildcard.local", PASSWORD = "ui-test-password-1234";
    await fetch(`${SB}/auth/v1/admin/users`, { method: "POST", headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" }, body: JSON.stringify({ email: EMAIL, password: PASSWORD, email_confirm: true, user_metadata: { username: "Testeur" } }) });
    const res = await fetch(`${SB}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: env.SUPABASE_ANON_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ email: EMAIL, password: PASSWORD }) });
    const session = await res.json();
    let captured = [];
    const sb = createServerClient(SB, env.SUPABASE_ANON_KEY, { cookies: { getAll: () => [], setAll: (cs) => { captured = cs; } } });
    await sb.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
    return { cookies: captured.map((c) => ({ name: c.name, value: c.value, domain: "localhost", path: "/" })), userId: session.user.id };
}

const { cookies, userId } = await auth();
// Ensure at least one published game exists for the community + studio views.
await fetch(`${SB}/rest/v1/eca_games`, { method: "POST", headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json", Prefer: "return=representation" }, body: JSON.stringify({ owner_id: userId, name: DEF.meta.name, status: "published", definition: DEF }) });

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const ctx = await browser.newContext();
await ctx.addCookies(cookies);
const errors = [];
async function shot(route, name, w, h) {
    const page = await ctx.newPage();
    page.on("console", (m) => { if (m.type() === "error") errors.push(`${name}: ${m.text().slice(0, 160)}`); });
    page.on("pageerror", (e) => errors.push(`${name} PAGEERROR ${e.message.slice(0, 160)}`));
    await page.setViewportSize({ width: w, height: h });
    await page.goto(`${BASE}${route}`, { waitUntil: "load", timeout: 45000 });
    await page.waitForTimeout(1800);
    const overflowX = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    await page.screenshot({ path: `${SHOTS}${name}.png`, fullPage: true });
    await page.close();
    return { name, route, w, overflowX };
}

// A live ECA game for the mobile + 2K board shots.
const api = ctx.request;
const room = await (await api.post(`${BASE}/api/rooms`, { data: { moduleId: `eca:${(await (await api.get(`${BASE}/api/studio/games`)).json()).games?.[0]?.id ?? ""}` } })).json().catch(() => ({}));

const report = [];
report.push(await shot("/fr/lobby", "eca-lobby-community", 1280, 1200));
report.push(await shot("/fr/studio", "eca-studio-hub", 1280, 1100));
report.push(await shot("/fr/lobby", "eca-lobby-375", 375, 900));
if (room?.code) {
    await api.post(`${BASE}/api/rooms/${room.code}/bots`, { data: { count: 2 } });
    const started = await (await api.post(`${BASE}/api/rooms/${room.code}/start`)).json();
    if (started?.gameId) {
        report.push(await shot(`/fr/game/${started.gameId}`, "eca-game-375", 375, 820));
        report.push(await shot(`/fr/game/${started.gameId}`, "eca-game-2560", 2560, 1080));
    }
}
await browser.close();
console.log(JSON.stringify({ report, consoleErrors: [...new Set(errors)].slice(0, 10) }, null, 1));
