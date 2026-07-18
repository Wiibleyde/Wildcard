#!/usr/bin/env node
// ECA end-to-end verifier — seeds a published studio game, hosts a real room for
// its `eca:<uuid>` module, and drives it two ways:
//   1. player + 2 bots  → screenshot the board (hand fan, piles, controls, log),
//      then fire one control action and screenshot the bot response.
//   2. host spectator + 2 bots → an all-bot game auto-plays; poll the game GET
//      (self-heals the bot chain) and screenshot the board progressing.
// Proves the whole loop: create → start → dispatch → bots → board render → log.
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

const CRAZY_EIGHTS = {
    version: 1,
    meta: {
        name: "Huit américain (démo)",
        description:
            "Même couleur ou même valeur. 8 joker, 7 saute, As inverse.",
        minPlayers: 2,
        maxPlayers: 5,
    },
    setup: { deckId: "french52", handSize: 7, startDiscard: true },
    turn: {
        allowDraw: true,
        allowPass: true,
        passRequiresDraw: true,
        reshuffleDiscard: true,
    },
    rules: [
        {
            id: "wild-eight",
            name: "8 — carte folle",
            event: "cardPlayed",
            conditions: [
                {
                    lhs: { kind: "card", source: "playedCard", prop: "rank" },
                    op: "eq",
                    rhs: { kind: "literal", value: "8" },
                },
            ],
            effects: [{ type: "acceptCard" }],
        },
        {
            id: "same-suit",
            name: "Même couleur",
            event: "cardPlayed",
            conditions: [
                {
                    lhs: { kind: "card", source: "playedCard", prop: "suit" },
                    op: "eq",
                    rhs: { kind: "card", source: "topDiscard", prop: "suit" },
                },
            ],
            effects: [{ type: "acceptCard" }],
        },
        {
            id: "same-rank",
            name: "Même valeur",
            event: "cardPlayed",
            conditions: [
                {
                    lhs: { kind: "card", source: "playedCard", prop: "rank" },
                    op: "eq",
                    rhs: { kind: "card", source: "topDiscard", prop: "rank" },
                },
            ],
            effects: [{ type: "acceptCard" }],
        },
    ],
    win: { condition: "emptyHand" },
};

async function authCookiesAndUser() {
    const EMAIL = "ui-test@wildcard.local";
    const PASSWORD = "ui-test-password-1234";
    await fetch(`${SB}/auth/v1/admin/users`, {
        method: "POST",
        headers: {
            apikey: SERVICE,
            Authorization: `Bearer ${SERVICE}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            email: EMAIL,
            password: PASSWORD,
            email_confirm: true,
            user_metadata: { username: "Testeur" },
        }),
    });
    const res = await fetch(`${SB}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: {
            apikey: env.SUPABASE_ANON_KEY,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    });
    if (!res.ok) throw new Error(`login ${res.status}: ${await res.text()}`);
    const session = await res.json();

    let captured = [];
    const sb = createServerClient(SB, env.SUPABASE_ANON_KEY, {
        cookies: {
            getAll: () => [],
            setAll: (cs) => {
                captured = cs;
            },
        },
    });
    const { error } = await sb.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
    });
    if (error) throw new Error(`setSession: ${error.message}`);
    const cookies = captured.map((c) => ({
        name: c.name,
        value: c.value,
        domain: "localhost",
        path: "/",
    }));
    return { cookies, userId: session.user.id };
}

async function seedPublishedGame(ownerId) {
    const res = await fetch(`${SB}/rest/v1/eca_games`, {
        method: "POST",
        headers: {
            apikey: SERVICE,
            Authorization: `Bearer ${SERVICE}`,
            "Content-Type": "application/json",
            Prefer: "return=representation",
        },
        body: JSON.stringify({
            owner_id: ownerId,
            name: CRAZY_EIGHTS.meta.name,
            description: CRAZY_EIGHTS.meta.description,
            status: "published",
            definition: CRAZY_EIGHTS,
        }),
    });
    if (!res.ok) throw new Error(`seed ${res.status}: ${await res.text()}`);
    const [row] = await res.json();
    return row.id;
}

const { cookies, userId } = await authCookiesAndUser();
const ecaGameId = await seedPublishedGame(userId);
const moduleId = `eca:${ecaGameId}`;

const ping = await fetch(BASE).catch(() => null);
if (!ping) {
    console.error(`Dev server not on ${BASE} — run: bun run dev`);
    process.exit(1);
}
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const ctx = await browser.newContext();
await ctx.addCookies(cookies);

async function post(path, data) {
    const res = await ctx.request.post(`${BASE}${path}`, data ? { data } : {});
    const body = await res.json().catch(() => ({}));
    if (!res.ok())
        throw new Error(`${path} -> ${res.status()} ${JSON.stringify(body)}`);
    return body;
}

const errors = [];
function watch(page) {
    page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text().slice(0, 200));
    });
    page.on("pageerror", (e) =>
        errors.push(`PAGEERROR ${e.message.slice(0, 200)}`),
    );
}

// ── Variant 1: player + 2 bots — hand fan + one action ──
const r1 = await post("/api/rooms", { moduleId });
await post(`/api/rooms/${r1.code}/bots`, { count: 2 });
const g1 = await post(`/api/rooms/${r1.code}/start`);

const p1 = await ctx.newPage();
watch(p1);
await p1.setViewportSize({ width: 1280, height: 900 });
await p1.goto(`${BASE}/fr/game/${g1.gameId}`, {
    waitUntil: "load",
    timeout: 45000,
});
await p1.waitForTimeout(1800);
await p1.screenshot({ path: `${SHOTS}eca-player-before.png`, fullPage: true });

let acted = "none";
// Prefer laying a card from the hand; fall back to a control (Draw/Pass).
const handCard = p1
    .locator(
        '[data-zone-key="hand"] button:enabled, [data-zone-key="hand"] [role="button"]',
    )
    .first();
const control = p1.locator("button.btn-game:enabled").first();
if (await handCard.count()) {
    await handCard.click().catch(() => {});
    acted = "hand-card";
} else if (await control.count()) {
    await control.click().catch(() => {});
    acted = "control";
}
await p1.waitForTimeout(2200);
await p1.screenshot({ path: `${SHOTS}eca-player-after.png`, fullPage: true });
await p1.close();

// ── Variant 2: host spectator + 2 bots — autonomous all-bot game ──
const r2 = await post("/api/rooms", { moduleId });
await post(`/api/rooms/${r2.code}/role`, { role: "spectator" });
await post(`/api/rooms/${r2.code}/bots`, { count: 2 });
const g2 = await post(`/api/rooms/${r2.code}/start`);

const p2 = await ctx.newPage();
watch(p2);
await p2.setViewportSize({ width: 1280, height: 900 });
await p2.goto(`${BASE}/fr/game/${g2.gameId}`, {
    waitUntil: "load",
    timeout: 45000,
});
// Poll the full GET a few times: each read self-heals a stranded bot chain and
// advances the all-bot game, so screenshots catch it progressing.
const versions = [];
for (let i = 0; i < 6; i++) {
    const body = await post(`/api/games/${g2.gameId}`).catch(() => ({}));
    versions.push(body.version);
    await p2.waitForTimeout(1500);
}
await p2.reload({ waitUntil: "load" });
await p2.waitForTimeout(1800);
await p2.screenshot({ path: `${SHOTS}eca-spectator.png`, fullPage: true });
const final = await post(`/api/games/${g2.gameId}`).catch(() => ({}));
await p2.close();

await browser.close();
console.log(
    JSON.stringify(
        {
            ecaGameId,
            moduleId,
            player: { room: r1.code, gameId: g1.gameId, acted },
            spectator: {
                room: r2.code,
                gameId: g2.gameId,
                versions,
                finalVersion: final.version,
                isOver: final.isOver,
            },
            consoleErrors: [...new Set(errors)].slice(0, 10),
            shots: [
                "eca-player-before",
                "eca-player-after",
                "eca-spectator",
            ].map((s) => `${SHOTS}${s}.png`),
        },
        null,
        1,
    ),
);
