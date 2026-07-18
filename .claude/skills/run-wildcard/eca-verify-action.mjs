#!/usr/bin/env node
// Focused proof that a HUMAN action round-trips for an ECA room: seed a
// published studio game, host a room + 2 bots, start, then as the authenticated
// player GET the game, pick a legal move from the module's own legalActions,
// POST it to /actions (the exact path the board's onAction uses), and confirm
// the version advanced and events were emitted. Screenshots the result.
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
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;

const DEF = {
    version: 1,
    meta: { name: "Huit américain (démo)", minPlayers: 2, maxPlayers: 5 },
    setup: { deckId: "french52", handSize: 7, startDiscard: true },
    turn: { allowDraw: true, allowPass: true, passRequiresDraw: true, reshuffleDiscard: true },
    rules: [
        { id: "wild-eight", name: "8 — carte folle", event: "cardPlayed", conditions: [{ lhs: { kind: "card", source: "playedCard", prop: "rank" }, op: "eq", rhs: { kind: "literal", value: "8" } }], effects: [{ type: "acceptCard" }] },
        { id: "same-suit", name: "Même couleur", event: "cardPlayed", conditions: [{ lhs: { kind: "card", source: "playedCard", prop: "suit" }, op: "eq", rhs: { kind: "card", source: "topDiscard", prop: "suit" } }], effects: [{ type: "acceptCard" }] },
        { id: "same-rank", name: "Même valeur", event: "cardPlayed", conditions: [{ lhs: { kind: "card", source: "playedCard", prop: "rank" }, op: "eq", rhs: { kind: "card", source: "topDiscard", prop: "rank" } }], effects: [{ type: "acceptCard" }] },
    ],
    win: { condition: "emptyHand" },
};

async function auth() {
    const EMAIL = "ui-test@wildcard.local";
    const PASSWORD = "ui-test-password-1234";
    await fetch(`${SB}/auth/v1/admin/users`, { method: "POST", headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" }, body: JSON.stringify({ email: EMAIL, password: PASSWORD, email_confirm: true, user_metadata: { username: "Testeur" } }) });
    const res = await fetch(`${SB}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: env.SUPABASE_ANON_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ email: EMAIL, password: PASSWORD }) });
    const session = await res.json();
    let captured = [];
    const sb = createServerClient(SB, env.SUPABASE_ANON_KEY, { cookies: { getAll: () => [], setAll: (cs) => { captured = cs; } } });
    await sb.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
    return { cookies: captured.map((c) => ({ name: c.name, value: c.value, domain: "localhost", path: "/" })), userId: session.user.id };
}

const { cookies, userId } = await auth();
const seed = await fetch(`${SB}/rest/v1/eca_games`, { method: "POST", headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json", Prefer: "return=representation" }, body: JSON.stringify({ owner_id: userId, name: DEF.meta.name, status: "published", definition: DEF }) });
const [row] = await seed.json();
const moduleId = `eca:${row.id}`;

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const ctx = await browser.newContext();
await ctx.addCookies(cookies);
const api = ctx.request;

async function jpost(path, data) {
    const r = await api.post(`${BASE}${path}`, data ? { data } : {});
    const b = await r.json().catch(() => ({}));
    if (!r.ok()) throw new Error(`${path} -> ${r.status()} ${JSON.stringify(b)}`);
    return b;
}
async function jget(path) {
    const r = await api.get(`${BASE}${path}`);
    return r.json();
}

const room = await jpost("/api/rooms", { moduleId });
await jpost(`/api/rooms/${room.code}/bots`, { count: 2 });
const { gameId } = await jpost(`/api/rooms/${room.code}/start`);

// GET the authoritative payload; pick a legal move the module itself offered.
const before = await jget(`/api/games/${gameId}`);
const legal = before.legalActions ?? [];
const move = legal.find((a) => a.type === "playCard") ?? legal.find((a) => a.type === "drawCard") ?? legal[0];
const played = await jpost(`/api/games/${gameId}/actions`, { version: before.version, action: move });
const after = await jget(`/api/games/${gameId}`);

const page = await ctx.newPage();
await page.setViewportSize({ width: 1280, height: 900 });
await page.goto(`${BASE}/fr/game/${gameId}`, { waitUntil: "load", timeout: 45000 });
await page.waitForTimeout(2000);
await page.screenshot({ path: `${SHOTS}eca-human-play.png`, fullPage: true });
await browser.close();

console.log(JSON.stringify({
    moduleId,
    gameId,
    beforeModuleId: before.moduleId,
    beforeVersion: before.version,
    chosenMove: move?.type,
    postOk: played.ok === true,
    postVersion: played.version,
    postEvents: (played.events ?? []).map((e) => e.type),
    afterVersion: after.version,
    afterTopIsOver: after.isOver,
}, null, 1));
