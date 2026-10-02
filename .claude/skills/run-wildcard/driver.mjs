#!/usr/bin/env node
// Wildcard UI driver — authenticates against the local Supabase stack and
// drives the Next.js app with headless Chromium.
//
//   node .claude/skills/run-wildcard/driver.mjs shoot   [--routes a,b] [--widths 375,1920]
//   node .claude/skills/run-wildcard/driver.mjs play
//
// `shoot` screenshots routes across viewport widths and reports horizontal
// overflow + console errors. `play` creates a real Président game with bots,
// clicks an action button, and screenshots before/after.
//
// Must live inside the repo: bare imports (@supabase/ssr, playwright) resolve
// against the project's node_modules. Run from the repo root.
import { mkdirSync, readFileSync } from "node:fs";
import { createServerClient } from "@supabase/ssr";
import { chromium } from "playwright";

const ROOT = new URL("../../../", import.meta.url).pathname;
const BASE = "http://localhost:3000";
const SHOTS = `${ROOT}.uitest/shots/`;
mkdirSync(SHOTS, { recursive: true });

const args = process.argv.slice(2);
const mode = args.find((a) => !a.startsWith("--")) ?? "shoot";
const opt = (name, fallback) => {
    const a = args.find((x) => x.startsWith(`--${name}=`));
    return a ? a.split("=")[1].split(",") : fallback;
};

// ── Auth: admin-create a confirmed user, password-grant, emit ssr cookie ──
const env = Object.fromEntries(
    readFileSync(`${ROOT}.env.local`, "utf8")
        .split("\n")
        .filter((l) => l.includes("=") && !l.startsWith("#"))
        .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const SB = env.SUPABASE_URL;

async function authCookies() {
    const EMAIL = "ui-test@wildcard.local";
    const PASSWORD = "ui-test-password-1234";
    await fetch(`${SB}/auth/v1/admin/users`, {
        method: "POST",
        headers: {
            apikey: env.SUPABASE_SECRET_KEY,
            Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            email: EMAIL,
            password: PASSWORD,
            email_confirm: true,
            user_metadata: { username: "Testeur" },
        }),
    }); // 422 = already exists, fine
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

    // Let @supabase/ssr serialize the session into its own cookie format
    let captured = [];
    const sb = createServerClient(SB, env.SUPABASE_ANON_KEY, {
        cookieEncoding: "raw",
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
    return captured.map((c) => ({
        name: c.name,
        value: c.value,
        domain: "localhost",
        path: "/",
    }));
}

// ── Shared setup ──
const ping = await fetch(BASE).catch(() => null);
if (!ping) {
    console.error(`Dev server not responding on ${BASE} — run: bun run dev`);
    process.exit(1);
}
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const ctx = await browser.newContext();
await ctx.addCookies(await authCookies());

async function post(path, data) {
    const res = await ctx.request.post(`${BASE}${path}`, data ? { data } : {});
    const body = await res.json().catch(() => ({}));
    if (!res.ok())
        throw new Error(`${path} -> ${res.status()} ${JSON.stringify(body)}`);
    return body;
}

function watchErrors(page, sink) {
    page.on("console", (m) => {
        if (m.type() === "error") sink.push(m.text().slice(0, 200));
    });
    page.on("pageerror", (e) =>
        sink.push(`PAGEERROR ${e.message.slice(0, 200)}`),
    );
}

// ── Modes ──
if (mode === "shoot") {
    const widths = opt("widths", ["375", "768", "1920", "2560"]).map(Number);
    const moduleId = opt("module", ["president"])[0];
    // Bots needed to reach min players: president 3, bataille 2, solitaire 1 (solo).
    const BOTS = { president: 3, bataille: 1, solitaire: 0 };
    const lobbyRoom = await post("/api/rooms", { moduleId: "president" });
    await post(`/api/rooms/${lobbyRoom.code}/bots`, { count: 2 });
    const gameRoom = await post("/api/rooms", { moduleId });
    const botCount = BOTS[moduleId] ?? 0;
    if (botCount > 0)
        await post(`/api/rooms/${gameRoom.code}/bots`, { count: botCount });
    const started = await post(`/api/rooms/${gameRoom.code}/start`);

    const ALL = {
        home: "/fr",
        login: "/fr/dev-login",
        lobby: "/fr/lobby",
        profile: "/fr/profile",
        history: "/fr/profile/history",
        leaderboard: "/fr/leaderboard",
        customize: "/fr/customize",
        preview: "/fr/customize/preview",
        room: `/fr/lobby/${lobbyRoom.code}`,
        game: `/fr/game/${started.gameId}`,
    };
    const names = opt("routes", Object.keys(ALL));

    const report = [];
    for (const name of names) {
        const page = await ctx.newPage();
        const errors = [];
        watchErrors(page, errors);
        for (const width of widths) {
            await page.setViewportSize({
                width,
                height: Math.round(width * 1.1) > 1100 ? 1080 : 812,
            });
            await page.goto(`${BASE}${ALL[name]}`, {
                waitUntil: "load",
                timeout: 45000,
            });
            await page.waitForTimeout(1800); // fonts + GSAP entry animations
            const overflowX = await page.evaluate(() => {
                const d = document.documentElement;
                return d.scrollWidth - d.clientWidth;
            });
            await page.screenshot({
                path: `${SHOTS}${name}-${width}.png`,
                fullPage: true,
            });
            report.push({ route: name, width, overflowX });
        }
        if (errors.length)
            report.push({
                route: name,
                consoleErrors: [...new Set(errors)].slice(0, 8),
            });
        await page.close();
    }
    console.log(JSON.stringify(report, null, 1));
    console.log(`screenshots: ${SHOTS}`);
}

if (mode === "play") {
    const room = await post("/api/rooms", { moduleId: "president" });
    await post(`/api/rooms/${room.code}/bots`, { count: 3 });
    const { gameId } = await post(`/api/rooms/${room.code}/start`);

    const page = await ctx.newPage();
    const errors = [];
    watchErrors(page, errors);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(`${BASE}/fr/game/${gameId}`, {
        waitUntil: "load",
        timeout: 45000,
    });
    await page.waitForTimeout(1800);
    await page.screenshot({ path: `${SHOTS}play-before.png`, fullPage: true });

    // Turn controls are GameButtons (.wc-btn) rendered by TableControls — a
    // pass button, or one button per playable combination when leading. Chat
    // "Envoyer" and "Quitter la partie" are wc-btn too: skip them.
    const button = page
        .locator("button.wc-btn:enabled")
        .filter({ hasNotText: /Envoyer|Send|Quitter|Leave/ })
        .first();
    // Bots lead first and are paced by the client: allow a few bot turns.
    await button.waitFor({ timeout: 30000 });
    await button.click();
    await page.waitForTimeout(2000); // server round-trip + realtime refetch + animation
    await page.screenshot({ path: `${SHOTS}play-after.png`, fullPage: true });

    console.log(
        JSON.stringify(
            { gameId, clicked: true, consoleErrors: errors.slice(0, 8) },
            null,
            1,
        ),
    );
    console.log(`screenshots: ${SHOTS}play-before.png / play-after.png`);
}

if (mode === "netwatch") {
    // Plays a Président game vs 3 bots for ~25s, clicking whenever it is our
    // turn, and reports how the client syncs: HTTP calls per endpoint and the
    // Realtime "version" broadcasts received on the game channel.
    const seconds = Number(opt("seconds", ["25"])[0]);
    const room = await post("/api/rooms", { moduleId: "president" });
    await post(`/api/rooms/${room.code}/bots`, { count: 3 });
    const { gameId } = await post(`/api/rooms/${room.code}/start`);

    const page = await ctx.newPage();
    const errors = [];
    watchErrors(page, errors);
    const t0 = Date.now();
    const http = [];
    const rings = [];
    page.on("request", (r) => {
        const u = new URL(r.url());
        if (u.pathname.startsWith("/api/games/"))
            http.push({
                at: Date.now() - t0,
                method: r.method(),
                path: u.pathname.replace(gameId, ":id") + u.search,
            });
    });
    page.on("websocket", (ws) => {
        ws.on("framereceived", ({ payload }) => {
            const text = typeof payload === "string" ? payload : "";
            if (text.includes('"version"') && text.includes("broadcast"))
                rings.push(Date.now() - t0);
        });
    });
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(`${BASE}/fr/game/${gameId}`, {
        waitUntil: "load",
        timeout: 45000,
    });
    const button = page
        .locator("button.wc-btn:enabled")
        .filter({ hasNotText: /Envoyer|Send|Quitter|Leave/ })
        .first();
    let clicks = 0;
    while (Date.now() - t0 < seconds * 1000) {
        if (await button.isVisible().catch(() => false)) {
            await button.click().catch(() => {});
            clicks++;
        }
        await page.waitForTimeout(400);
    }
    const byPath = {};
    for (const r of http) {
        const key = `${r.method} ${r.path.replace(/since=\d+/, "since=N")}`;
        byPath[key] = (byPath[key] ?? 0) + 1;
    }
    console.log(
        JSON.stringify(
            {
                gameId,
                seconds,
                clicks,
                broadcastRings: rings.length,
                httpTotal: http.length,
                byPath,
                consoleErrors: errors.slice(0, 8),
            },
            null,
            1,
        ),
    );
}

if (mode === "solplay") {
    const room = await post("/api/rooms", { moduleId: "solitaire" });
    const { gameId } = await post(`/api/rooms/${room.code}/start`);

    const page = await ctx.newPage();
    const errors = [];
    watchErrors(page, errors);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${BASE}/fr/game/${gameId}`, {
        waitUntil: "load",
        timeout: 45000,
    });
    await page.waitForTimeout(1800);

    // Draw a few cards off the stock pile (zone-level click).
    const stock = page.locator('[data-zone-key="stock"]');
    for (let i = 0; i < 5; i++) {
        await stock.click();
        await page.waitForTimeout(600);
    }
    await page.screenshot({ path: `${SHOTS}sol-drawn.png`, fullPage: true });

    console.log(
        JSON.stringify({ gameId, consoleErrors: errors.slice(0, 8) }, null, 1),
    );
    console.log(`screenshots: ${SHOTS}sol-drawn.png`);
}

await browser.close();
