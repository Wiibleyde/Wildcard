# Wildcard — Architecture des échanges en partie

Ce document décrit le **flux d'échange réseau pendant une partie** : comment une
action joueur est jouée, validée, synchronisée entre clients, et comment l'UI
réagit instantanément (optimistic UI) tout en restant **server-authoritative**.

> Les schémas sont en [Mermaid](https://mermaid.js.org/) — rendus nativement par
> GitHub, GitLab et la plupart des éditeurs Markdown.

---

## 1. Vue d'ensemble — acteurs & responsabilités

```mermaid
flowchart LR
    subgraph Client["Client (navigateur)"]
        GPC["GamePlayClient<br/>onAction · payloadRef · versionRef"]
        GT["GameTable<br/>mapView · predict"]
        UGC["useGameChannel<br/>doorbell + poll"]
    end

    subgraph API["Next.js API Routes (service role)"]
        VER["GET /api/games/[id]/version<br/>getGameVersion"]
        FULL["GET /api/games/[id]<br/>getGameClientState"]
        ACT["POST /api/games/[id]/actions<br/>applyAction → renvoie le payload"]
    end

    subgraph Engine["Moteur de jeu (pur)"]
        RUN["runner.dispatch"]
        MOD["GameModule<br/>apply · view · legalActions"]
    end

    subgraph DB["Supabase / PostgreSQL"]
        META["games<br/>(meta publique: version, current_player_id, is_over)"]
        SECRET["game_states<br/>(état SECRET — RLS deny-all)"]
        LOG["game_actions<br/>(log audit / replay)"]
        RT["Realtime<br/>postgres_changes"]
    end

    GT -->|"action"| GPC
    GPC -->|"predict() local"| GT
    GPC -->|"POST action"| ACT
    ACT -->|"payload (réponse) → adopt"| GPC
    UGC -->|"probe"| VER
    UGC -->|"refetch (poll/doorbell)"| FULL

    ACT --> RUN --> MOD
    ACT -->|"compare-and-set"| META
    ACT -->|"write"| SECRET
    ACT -->|"append"| LOG
    META -->|"UPDATE (version bump)"| RT
    RT -->|"doorbell"| UGC

    FULL --> SECRET
    FULL --> MOD
    VER --> META
```

**Principes clés**

- Le client ne reçoit **jamais** l'état brut : seulement la projection
  `view()` redactée (les mains adverses deviennent des compteurs). `game_states`
  est en RLS deny-all, accessible uniquement via service-role côté serveur.
- Toute mutation passe par `POST /actions` → `applyAction` (jamais d'écriture
  directe depuis le client).
- `games` (méta publique) et `game_states` (secret) sont **séparés** : le poll
  chaud lit la méta, jamais le secret.

---

## 2. Action joueur — optimistic UI + réconciliation

Le cas central : le joueur joue une carte. L'UI applique le coup
**immédiatement** (`predict`), puis le serveur fait foi.

```mermaid
sequenceDiagram
    autonumber
    actor U as Joueur
    participant GT as GameTable
    participant GPC as GamePlayClient
    participant ACT as POST /actions
    participant ENG as runner.dispatch + module
    participant DB as Supabase (games/states/actions)

    U->>GT: clic carte / combo
    GT->>GPC: onAction(action)

    Note over GPC: snapshot = payloadRef.current (version N)
    GPC->>GT: predict(view, action, viewerId)

    alt predict ≠ null (coup pleinement visible)
        GT-->>GPC: vue prédite
        GPC->>GPC: setPayload(prédite)<br/>legalActions=[] · currentPlayerId=null<br/>(version reste N — input gelé, pas de spinner)
        GT-->>U: carte jouée INSTANTANÉMENT
    else predict = null (révèle une carte cachée)
        GPC->>GPC: setPending(true) (spinner, attente serveur)
    end

    GPC->>ACT: POST { version: N, action }
    ACT->>ENG: dispatch(module, state, action, actorId)
    ENG-->>ACT: { ok, state', events }

    alt action valide
        ACT->>DB: UPDATE games SET version=N+1 WHERE version=N (compare-and-set)
        ACT->>DB: write game_states · append game_actions
        ACT->>ACT: build payload acteur (vue redactée depuis state')
        ACT-->>GPC: 200 { version: N+1, payload }
        Note over GPC: gate strictement-plus-récent :<br/>N+1 > N ⇒ adopte le payload<br/>(écrase la prédiction, AUCUN GET de suivi)
    else illégale / conflit
        ACT-->>GPC: 422 / 409
        GPC->>U: notice "coup refusé"
        GPC->>GPC: rollback → snapshot (si versionRef toujours N)
        GPC->>GPC: refetchFull() — GET /api/games/[id] (état autoritaire)
    end
```

> **1 aller-retour par coup.** `applyAction` détient déjà l'état committé : il
> renvoie le payload redacté de l'acteur dans la réponse POST. Le client
> l'adopte directement — plus de `GET` de suivi (avant : POST **puis** GET = 2
> aller-retours + 2 chargements d'état). Le `GET` complet ne sert plus qu'au
> chemin poll/doorbell (coups des autres).

**Pourquoi la version reste à N pendant le vol**

La vue optimiste garde `version = N`. Donc :

- un **probe de poll** en vol renvoie `N` (serveur pas encore committé) →
  `N ≤ N` → ignoré, la prédiction n'est pas écrasée ;
- au retour serveur, `refetchFull` voit `N+1 > N` → adopte la vue autoritaire ;
- sur **rejet**, rollback au snapshot seulement si `versionRef === N` (rien de
  plus récent n'a atterri entre-temps).

---

## 3. Cycle de vie d'un coup optimiste (état client)

```mermaid
stateDiagram-v2
    [*] --> Idle
    Idle --> Predicted: onAction + predict≠null
    Idle --> Pending: onAction + predict=null

    Predicted --> Reconciled: POST ok → refetch (N+1 adopté)
    Predicted --> RolledBack: POST !ok → snapshot restauré
    Pending --> Reconciled: POST ok → refetch
    Pending --> Idle: POST !ok → notice

    RolledBack --> Idle: refetch (état autoritaire)
    Reconciled --> Idle

    note right of Predicted
        input gelé : legalActions=[]
        currentPlayerId=null
        version inchangée (N)
    end note
```

---

## 4. Coup adverse / bot — synchronisation par poll à deux étages

Quand un **autre** joueur (ou un bot) agit, le client l'apprend par le doorbell
Realtime ou le poll, puis ne télécharge le gros payload que si la version a
réellement avancé.

```mermaid
sequenceDiagram
    autonumber
    participant DB as Supabase
    participant RT as Realtime (postgres_changes)
    participant UGC as useGameChannel
    participant GPC as GamePlayClient
    participant VER as GET /version
    participant FULL as GET /api/games/[id]

    Note over DB: un autre joueur/bot commit → games.version = N+1 (UPDATE)

    par Doorbell
        DB-->>RT: UPDATE games (version bump)
        RT-->>UGC: événement (sonnette)
    and Poll de secours (800ms / 4000ms si mon tour)
        UGC->>UGC: tick
    end

    UGC->>VER: sync() → probe version
    VER-->>UGC: { version: N+1 }
    alt N+1 > versionRef (N)
        UGC->>FULL: refetchFull()
        FULL-->>GPC: GameClientPayload (vue redactée)
        GPC->>GPC: setPayload (adopte) · versionRef = N+1
    else inchangé
        UGC-->>UGC: skip (aucun fetch lourd)
    end
```

**Deux étages — pourquoi**

- `GET /version` lit une seule ligne méta indexée (`games`) → quelques octets,
  pas de secret, pas de `view()`. Pollable à la cadence des bots sans coût.
- `GET /api/games/[id]` (payload complet redacté) **uniquement** quand
  `version` a avancé.
- `postgres_changes` n'est pas fiable sur la stack self-hosted → le poll est le
  canal dépendable ; le doorbell ne fait qu'accélérer.

---

## 5. Chaîne de bots (après réponse)

Après une action humaine, les bots qui ont le trait jouent **après la réponse
HTTP** (`after()`), un coup à la fois, chacun bumpant `version` → chaque coup
arrive comme sa propre mise à jour Realtime (turns visibles, pas un burst).

```mermaid
sequenceDiagram
    autonumber
    participant ACT as applyAction
    participant AB as advanceBots (after)
    participant DB as Supabase

    ACT-->>ACT: réponse 200 envoyée au client
    ACT->>AB: after(() => advanceBots(...))

    loop tant qu'un bot a le trait & partie non finie
        AB->>AB: sleep(BOT_TURN_DELAY_MS ≈ 900ms)
        AB->>AB: chooseBotAction(legalActions)
        AB->>DB: UPDATE games version+1 WHERE version=prev (compare-and-set)
        alt claim réussi
            AB->>DB: write game_states · append game_actions
            DB-->>DB: UPDATE → Realtime → clients refetch
        else perdu la course
            AB-->>AB: stop (une autre chaîne / action possède l'état)
        end
    end
```

> Self-heal : une chaîne `after()` peut mourir (invocation serverless tuée,
> restart). Chaque lecture (`getGameVersion` / `getGameClientState`) re-kicke la
> chaîne si un bot a le trait et que la ligne est restée intouchée au-delà de
> `STALL_RESUME_MS`.

---

## 6. Garanties transverses

| Garantie | Mécanisme |
|----------|-----------|
| **Server-authoritative** | toute action validée par `module.apply` côté serveur ; coup illégal refusé (422), jamais joué sur confiance client |
| **Anti-double-coup / anti-stale** | concurrence optimiste : `POST` envoie `version`, `applyAction` fait un compare-and-set sur `games.version` (loser → 409) |
| **Confidentialité (RLS en code)** | `view()` redacte les mains adverses ; `game_states` en RLS deny-all (service-role only) |
| **Déterminisme / replay** | RNG seedé dans le `state` ; `game_actions` rejoue toute partie depuis `(seed, log)` |
| **UX instantanée** | `predict()` applique le coup localement ; le serveur réconcilie via le gate strictement-plus-récent ; rollback sur rejet |
| **1 aller-retour / coup** | `applyAction` renvoie le payload redacté dans la réponse POST → le client l'adopte sans `GET` de suivi (avant : POST + GET) |
| **Poll bon marché** | deux étages : probe `version` (méta) → payload complet seulement si bump |

Détails d'implémentation : `src/components/game/GamePlayClient.tsx`,
`src/lib/realtime/useGameChannel.ts`, `src/lib/models/game.ts`,
`src/lib/games/table/types.ts` (contrat `predict`), `src/lib/engine/runner.ts`.
