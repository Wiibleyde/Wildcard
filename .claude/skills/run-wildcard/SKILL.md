---
name: run-wildcard
description: Run, screenshot, and drive the Wildcard app locally — launch the dev stack, get an authenticated headless-browser session, screenshot every page at mobile→2K widths, click through a live game. Use when asked to run the app, verify a UI change, take screenshots, test responsiveness, or reproduce an interface bug.
---

# Run Wildcard

Next.js 16 app + local Supabase stack (docker). Drive it with
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
bun run dev   # docker compose (supabase) + next dev on :3000
```

Often already running — check first:

```bash
curl -sf -o /dev/null -w "%{http_code}\n" http://localhost:3000   # 307 = up
```

`supabase-storage` and `supabase-studio` containers may show *unhealthy* in
`docker ps` — harmless for UI work.

## Run (agent path) — the driver

No UI login exists for agents (OAuth-only). The driver self-authenticates:
it admin-creates a confirmed user `ui-test@wildcard.local` on the local
Supabase, does a password-grant login, and forges the `sb-localhost-auth-token`
cookie through `@supabase/ssr` itself — so the session matches exactly what
Next.js expects.

**Screenshot matrix** — every key route × widths, with automated
horizontal-overflow + console-error report (JSON on stdout):

```bash
node .claude/skills/run-wildcard/driver.mjs shoot
node .claude/skills/run-wildcard/driver.mjs shoot --routes=lobby,game --widths=375,1920
```

Routes: `home login lobby profile customize preview room game` — `room` and
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

`bun run dev` → http://localhost:3000 → login via Google/Discord OAuth.
Useless headless; agents use the driver.

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
- Game action buttons all carry the `btn-game` class (the shared
  `GameButton`) — `button.btn-game:enabled` is the stable selector for
  controls.

## Troubleshooting

- `Dev server not responding on http://localhost:3000` (driver exit 1) →
  run `bun run dev`, wait for the 307 from the curl check above. (Auth is
  self-healing: the driver re-creates its test user on every run.)
- Hand/clickable cards rendering as ~4px slivers → `Card`'s root must keep
  `block w-full` (buttons collapse to their borders without it; regression
  fixed 2026-06-12).
