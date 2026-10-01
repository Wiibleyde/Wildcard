---
name: run-wildcard
description: Run, screenshot, and drive the Wildcard app locally — launch the dev stack, get an authenticated headless-browser session, screenshot every page at mobile→2K widths, click through a live game. Use when asked to run the app, verify a UI change, take screenshots, test responsiveness, or reproduce an interface bug.
---

# Run Wildcard

Next.js 16 app + local Supabase (Supabase CLI, schema `wildcard`). Drive it with
`.claude/skills/run-wildcard/driver.mjs` (Playwright, headless Chromium).
All paths below are relative to the repo root.

## Prerequisites

Playwright is a devDependency but its browser needs a one-time download:

```bash
bun install
bunx playwright install chromium
```

## Launch

```bash
bun run dev:up   # Supabase CLI: start + migrations (once; --fresh to reset + seed)
bun run dev      # next dev on :3000 (.env.local from .env.local.example + dev:up keys)
```

Often already running — check first:

```bash
curl -sf -o /dev/null -w "%{http_code}\n" http://localhost:3000   # 200 = up
```


## Run (agent path) — the driver

In prod, sign-in happens on the portal (auth.wiibleyde.dev). The driver
self-authenticates: it admin-creates a confirmed user `ui-test@wildcard.local`
on the local Supabase (SUPABASE_SECRET_KEY), does a password-grant login, and
forges the session cookie through `@supabase/ssr` with `cookieEncoding: "raw"`
— the portal's format, exactly what the app reads. That user has no portal
pseudo, so it shows as the fallback name `Joueur xxxx`.

**Screenshot matrix** — every key route × widths, with automated
horizontal-overflow + console-error report (JSON on stdout):

```bash
node .claude/skills/run-wildcard/driver.mjs shoot
node .claude/skills/run-wildcard/driver.mjs shoot --routes=lobby,game --widths=375,1920
```

Routes: `home login lobby profile customize preview room game` (`login` = the dev-login page) — `room` and
`game` are real: the driver creates rooms via `POST /api/rooms`
(`{moduleId: "president"}`), adds bots, and starts a game. Screenshots land in
`.uitest/shots/<route>-<width>.png` (gitignored). **Read the screenshots** —
`overflowX: 0` does not catch collapsed or hidden elements.

**Click-through** — creates a Président game with 3 bots, clicks the first
enabled action button, screenshots before/after, reports console errors:

```bash
node .claude/skills/run-wildcard/driver.mjs play
```

## Run (human path)

`bun run dev` → http://localhost:3000/fr/dev-login → one click on a seeded
account (`dev@local.test` admin / `player@local.test`, password `password123`).

## Test

```bash
bun run test   # vitest run — engine/game-module unit tests
```

## Gotchas

- **Never `waitForNetworkIdle`** — Supabase Realtime keeps a websocket open;
  it never settles. The driver uses `waitUntil: "load"` + a fixed 1800ms
  settle (fonts + GSAP card entry animations; screenshot earlier and cards
  are mid-flight).
- **The driver must live inside the repo** — it bare-imports `@supabase/ssr`
  and `playwright` from the project's `node_modules`; copied to `/tmp` it
  dies with `ERR_MODULE_NOT_FOUND`.
- **fullPage screenshots paint the fixed mobile bottom nav mid-image** (at
  its viewport position). Artifact, not a layout bug.
- **`bunx` output can be mangled in this environment** — call binaries
  directly: `./node_modules/.bin/biome`, `./node_modules/.bin/tsc`.
- Game modules registered: `bataille` (2 players), `president` (3–6 → use
  `count: 3` bots before `start`).
- Game action buttons are `GameButton`s with the `wc-btn` class. The chat
  "Envoyer" and "Quitter la partie" buttons are `wc-btn` too, so filter them
  out: `locator("button.wc-btn:enabled").filter({ hasNotText: /Envoyer|Quitter/ })`.
  When the player leads a trick there is no pass button — the controls are
  one button per playable combination.

## Troubleshooting

- `Dev server not responding on http://localhost:3000` (driver exit 1) →
  run `bun run dev:up` then `bun run dev`, wait for the curl check above. (Auth is
  self-healing: the driver re-creates its test user on every run.)
- Hand/clickable cards rendering as ~4px slivers → `Card`'s root must keep
  `block w-full` (buttons collapse to their borders without it; regression
  fixed 2026-06-12).
