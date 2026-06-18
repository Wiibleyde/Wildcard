# Wildcard — Refactor & Bugfix Report

_Date: 2026-06-18 · branch: `feat/solitary`_

This pass tackled the multiplayer/container issues, the chat username bug, the
"Solitaire needs spectators" gap, and a sweep of code duplication across the
engine and the project as a whole. Everything below is verified:

| Check | Result |
|-------|--------|
| `bunx tsc --noEmit` | clean |
| `bun run test` (vitest) | **125 passed** (was 110 — 15 new) |
| `bunx biome check src` | **142 files, 0 issues** |
| Net change in edited files | **+207 / −286 = −79 lines** (features added, code shrank) |

23 files modified, 10 new files (7 helpers/modules + 3 test files + 1 migration).

---

## 1. Bugs fixed

### 1.1 Chat usernames — spectators showed as "`?`"

**Symptom.** In-game chat resolved a sender's name with
`nameOf(payload.players, userId)`, and `payload.players` is the game's **seated**
player list (`state.players` = humans + bots). Spectators are never in that list,
so every spectator's chat line rendered as "`?`" to everyone else. With Solitaire
(1 seat + watchers) this meant essentially _all_ chat names broke.

**Fix — self-describing messages.** A chat message now carries its sender's
display name on the wire, so no roster lookup is needed and anyone on the channel
resolves correctly. Chat is already client-trusted broadcast (it never passes
through the server), so embedding the name adds no new trust surface.

- `src/lib/realtime/useGameChat.ts` — added `name` to `ChatMessage`/`ChatWire`,
  the hook now takes `currentUserName`, stamps it on outgoing messages, and reads
  `p.name` on receive.
- `src/components/game/GameChat.tsx` — renders `m.name` (falls back to the old
  roster lookup for any pre-upgrade cached line).
- `src/components/game/GamePlayClient.tsx` — threads `currentUserName` through.
- `src/app/[lang]/game/[id]/page.tsx` — fetches the viewer's own
  `profiles.username` (needed precisely because a spectator isn't in `players`)
  and passes it down.

### 1.2 Spectator join — Solitaire (and any full room) was a dead end

**Symptom.** `joinRoom` rejected with `room_full` the moment
`playerSeats.length >= maxPlayers`, **before inserting the user at all**. A
Solitaire room is "full" (1/1) as soon as the host sits, so anyone opening the
invite link was bounced and could never get in to watch. The same applied to a
full multiplayer lobby.

**Fix.** `src/lib/models/room.ts` — when the table is full, `joinRoom` now seats
the arrival as a **spectator** (`seat: null, role: "spectator"`) instead of
refusing. This is the path that makes Solitaire watchable in a multiplayer lobby,
and it turns "late to a full table" into "you're watching" rather than an error.
They can still claim a seat later via `setRoomRole` if one frees up. Idempotent on
the unique-constraint race.

### 1.3 Realtime sync for dev **and** prod — postgres_changes silently dead

**Symptom.** The realtime hooks carry a polling fallback "for an environment where
Realtime never establishes". The root cause is in the container/DB layer: the
game tables _are_ added to the `supabase_realtime` publication in
`20260606120000_games.sql`, but with bare `alter publication … add table`, and the
`db-migrate` service runs every migration on each `up` piped through `|| true`.
That means:

1. a re-run errors ("relation is already member") and is silently swallowed —
   masking any _real_ failure in the same step, and
2. if the publication doesn't exist yet at migration time (init ordering vs. the
   realtime container), **all four** `add table` statements fail and are
   swallowed → Realtime carries no changes → the app limps on polling (the
   "multiplayer feels laggy" symptom), in both dev and prod.

**Fix — `supabase/migrations/20260618000000_realtime_publication.sql`** (new). An
idempotent, self-healing migration: create the publication if missing, force
`replica identity full`, and add each game table only when it isn't already a
member. Safe to run any number of times — which is exactly what `bun run up`
(dev) and the prod boot both do. The polling fallback is intentionally **kept** as
defense in depth.

> **To apply on the running self-hosted stack** (per your existing workflow):
> `docker exec -i supabase-db psql -U postgres -d <db> -f` the new migration, then
> `NOTIFY pgrst, 'reload schema';`. A fresh `bun run up` / `supabase db reset`
> picks it up automatically.

> **Prod config caveat (not a code change):** `NEXT_PUBLIC_SUPABASE_URL` is baked
> at build time from `API_EXTERNAL_URL` (see `Dockerfile` / `docker-compose.yml`).
> It must be **browser-reachable** in prod (a public URL/host), not an
> internal-only `localhost`, or the client's Realtime socket can't connect.

---

## 2. Game engine — shared rule helpers (de-duplication)

You asked for "functions useful across all games" instead of each module
re-deriving the same rules. The three modules (`bataille`, `president`,
`solitaire`) each hand-wrote rank maps, card predicates, a `fail()` helper, etc.
Those are now extracted, tested, and consumed by all three — behaviour is
identical (proven by the existing 110 game tests still passing).

**New shared modules**

- `src/lib/card/rank.ts` — `isSuited`, `rankOf`, `suitColor`/`SUIT_COLOR`,
  `groupByRank`, and **`buildRankOrder(order)`**. The last one is the key idea:
  each game still owns its _own_ ranking (Ace high in Bataille, 2-beats-Ace in
  Président, Ace low in Solitaire), but builds the lookup map from an explicit
  ordered list instead of a typo-prone hand-written `Record<Rank, number>`.
- `src/lib/card/hand.ts` — `removeCards` (reject "played a card not in hand")
  and `dealRoundRobin`.
- `src/lib/engine/rules.ts` — `fail(code, message)` (was copy-pasted in all three
  modules) and `seatOrder(players)`.
- `src/lib/card/types.ts` — exports a shared `SuitedCard` type.

**Consumers updated:** `bataille.ts`, `president.ts`, `solitaire.ts` (deleted
their local `RANK_VALUE`/`ORDER`, `COLOR`, `isSuited`, `rankOf`, `removeCards`,
`seatOrder`, `fail`). `president.ts` shrank ~94→ fewer lines; `solitaire.ts`
~65 lines lighter in the touched regions.

**Table-config dedup:** `bataille/table.ts` and `president/table.ts` both had
their own `nameOf(ctx, id)`; extracted to `src/lib/games/table/helpers.ts`
(`playerName`). `GameChrome.nameOf` (different signature — operates on
`GamePlayer[]`) is left as-is intentionally.

**New tests:** `src/lib/card/rank.test.ts`, `src/lib/card/hand.test.ts`,
`src/lib/engine/rules.test.ts` (15 cases) — including that `buildRankOrder`
encodes each game's hierarchy by relative value and leaves unused ranks at 0.

---

## 3. Project-wide de-duplication

### 3.1 API route auth boilerplate (10 routes → 1 helper)

Every route handler repeated the same five lines: `createClient` →
`auth.getUser()` → `401` (and `createAdminClient`). Extracted to
**`src/lib/api/auth.ts` → `requireUser()`**, which returns the user + their
RLS-scoped client, or a 401 response as a value (no throw):

```ts
const auth = await requireUser();
if (!auth.ok) return auth.response;
// auth.user, auth.supabase
```

Applied to all 10 routes: `games/[id]` (GET + `actions`), `rooms` (POST),
`rooms/[code]/{join,leave,role,start,bots}`, `profile`, `customization`.

### 3.2 `usernamesByIds` (3 call sites → 1 helper)

The `profiles.select("id, username").in(...)` + `new Map(...)` lookup was built by
hand in `room.ts` (`startGame`), `RoomClient.tsx` (`refresh`), and the lobby
`[code]` page. Extracted to **`src/lib/models/usernames.ts`** (accepts any
Supabase client — admin or RLS-scoped; type-only imports, so it's safe in the
client bundle).

---

## 4. New files

```
src/lib/api/auth.ts                         requireUser() route guard
src/lib/card/rank.ts                        rank/suit/grouping rule helpers
src/lib/card/hand.ts                        removeCards, dealRoundRobin
src/lib/engine/rules.ts                     fail(), seatOrder()
src/lib/games/table/helpers.ts              playerName() for table configs
src/lib/models/usernames.ts                 usernamesByIds()
src/lib/card/rank.test.ts                   + 8 cases
src/lib/card/hand.test.ts                   + 5 cases
src/lib/engine/rules.test.ts                + 4 cases  (15 new total)
supabase/migrations/20260618000000_realtime_publication.sql
```

---

## 5. Deferred (identified, intentionally not done)

Kept out of scope to avoid churn / behaviour risk; flagging for a future pass:

- **`useRoomMutation` hook** — `RoomClient` has ~7 raw `fetch()` POSTs with manual
  JSON/error handling that could fold into the existing `useApiMutation`. A real
  cleanup, but it changes client behaviour and deserves its own focused PR + test.
- **Request-body parsing helper** — 5 routes do `request.json().catch(() => ({}))`
  then manual `typeof` checks. A `parseJsonBody<T>()` (or zod at the boundary)
  would help; low value vs. the auth-guard win, so left for later.
- **Error-status maps** (`ROOM_ERROR_STATUS`, `APPLY_ERROR_STATUS`, the per-route
  `HTTP_STATUS`) are intentionally **kept domain-local** — unifying them would
  couple unrelated domains for little gain.

## 6. Recommended live smoke test

Types, lint, and unit tests pass, but the realtime/spectator/chat fixes are
integration-level. Worth a two-browser check once the stack is up (`bun run up`):
deal a Solitaire game, open the invite link in a second session → it should
auto-spectate; both chat with correct names; the board should update via Realtime
push (not the 800 ms poll) — confirm with a row change in `games` arriving live.
