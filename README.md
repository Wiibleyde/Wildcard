# Wildcard

Plateforme de jeux de cartes multijoueur en ligne — projet de fin d'études Master.

**Stack** : Next.js 16 · React 19 · TypeScript strict · Tailwind CSS · Supabase (PostgreSQL, Auth, Realtime, RLS) — sur l'infra mutualisée wiibleyde.dev

---

## Architecture — infra mutualisée wiibleyde.dev

Wildcard ne tourne pas seul : il s'intègre à l'infrastructure partagée de
**wiibleyde.dev** (serveur *rivendell*), au même titre que les autres apps
(Kestion, …) :

| Brique | Rôle pour Wildcard |
|---|---|
| **Supabase partagé** (`supabase.wiibleyde.dev`) | Postgres 17, Auth, PostgREST, Realtime, Storage — Wildcard a **son propre schéma** `wildcard` |
| **Portal** (`auth.wiibleyde.dev`) | Connexion / inscription (email, Discord), compte, pseudo et avatar — **un seul compte pour toutes les apps** |
| **Caddy + CrowdSec** | HTTPS et filtrage devant `wildcard.wiibleyde.dev` |
| **Prometheus / Grafana / Umami** | Observabilité et analytics mutualisées |

Choix défendables :

- **Schéma dédié** plutôt que `public` : isolation stricte entre apps sur une
  même base (tables, fonctions, triggers, buckets, policies préfixés
  `wildcard`). Les migrations sont écrites avec le nom `wildcard` et réécrites
  en `wildcard_dev` pour le jumeau de développement — même code, deux schémas.
- **SSO par cookie partagé** : le portal écrit la session Supabase dans un
  cookie `.wiibleyde.dev` (encodage brut). Wildcard le relit, le rafraîchit au
  même format, et redirige vers `auth.wiibleyde.dev/login?next=…` les visiteurs
  non connectés. Pas de page de login à maintenir.
- **Identité au portal, jeu chez Wildcard** : `wildcard.profiles` ne porte que
  l'ancre du joueur (XP, ELO, inventaire, salons…). Pseudo et avatar sont lus
  dans `portal.profiles` via une seule fonction `security definer`
  (`wildcard.player_identities`), la RLS du portal ne montrant à chacun que son
  propre profil.
- **Ouvert à tout compte du portal** : un trigger `on_auth_user_wildcard` crée
  le profil de jeu de chaque nouveau compte (et un backfill ceux qui existaient).
- **Identité vérifiée** : `auth.getClaims()` (JWT ES256 vérifié contre le JWKS),
  jamais `getSession()`.
- **API authentifiée par jeton, pas par cookie** : le cookie du portal part
  avec toute requête *same-site* — et tous les `*.wiibleyde.dev` sont
  same-site, donc `SameSite=Lax` n'arrête pas une page d'une app voisine. Les
  routes `/api` n'acceptent que `Authorization: Bearer <access_token>`
  (signature, `iss`, `aud`, `exp`), plus un contrôle de révocation auprès de
  GoTrue mis en cache 15 s par `session_id` (`src/lib/auth/bearer.ts`). Le
  client (`apiFetch`) rafraîchit et rejoue une fois sur `token_expired`, renvoie
  au login sur `session_revoked`.
- **Amis et photo de profil au portal** : Wildcard n'a aucun stockage
  d'avatar ; la page `/profile/friends` parle à l'API du portal
  (`auth.wiibleyde.dev/api/v1`) avec le jeton de l'utilisateur — la RLS du
  portal décide, jamais une clé de service.
- **CSP stricte** : nonce par requête (`src/proxy.ts`), aucun script inline
  autorisé, `connect-src` limité à l'app, Supabase, le portal et Umami — une XSS
  sur une app volerait la session de toutes.

---

## Prérequis

| Outil | Version minimale | Installation |
|---|---|---|
| Bun | 1.4+ | [bun.sh](https://bun.sh) |
| Docker | 24+ | [docker.com](https://www.docker.com) |
| Supabase CLI | 2.100+ | [supabase.com/docs/guides/cli](https://supabase.com/docs/guides/cli) |

---

## Développement

Trois niveaux, du plus isolé au plus réaliste :

| Niveau | Commande | Ce qu'on teste |
|---|---|---|
| **Local** (Supabase CLI) | `bun run dev:up` + `bun run dev` | schéma, RLS, migrations, jeu complet — sans réseau |
| **Supabase partagé**, schéma `wildcard_dev` | `bun run dev:shared` | vraie auth (ES256), vrais comptes, vraie RLS — depuis localhost |
| **Déployé** | `wildcard.wiibleyde.dev` | tout, y compris le cookie partagé et le portal |

### Local

```bash
bun install
bun run dev:up                         # Supabase local (Postgres 17) + migrations
cp .env.local.example .env.local       # coller les clés affichées par dev:up
bun run dev                            # http://localhost:3000
```

Pas de portal en local : une page **`/fr/dev-login`** (disponible uniquement
sous `next dev`, 404 en production) connecte les comptes seedés en un clic :

| Compte | Mot de passe | Rôle | Pseudo |
|---|---|---|---|
| `dev@local.test` | `password123` | admin | `dev` |
| `player@local.test` | `password123` | joueur | `player` |

Le pseudo vient d'un **faux schéma `portal`** créé par la migration
`portal_stub` — uniquement quand aucun schéma `portal` n'existe (no-op sur
l'infra partagée).

`bun run dev:up --fresh` repart d'une base vide (migrations + seed).
Studio local : http://localhost:54323.

### Contre le Supabase partagé (`wildcard_dev`)

```bash
cp .env.shared.example .env.shared     # clé publishable + secret du Supabase partagé
bun run dev:shared                     # schéma wildcard_dev
```

Le cookie du portal ne peut pas se poser sur `localhost` : connexion via
`/fr/dev-login` avec un vrai compte email/mot de passe. Le schéma
`wildcard_dev` se met à jour sur le serveur avec `bun run db:apply:shared`
(cf. [`deploy/README.md`](deploy/README.md)).

---

## Commandes utiles

```bash
bun run dev               # Serveur Next.js (Turbopack)
bun run dev:up            # Supabase local + migrations (--fresh : reset + seed)
bun run dev:down          # Arrêter le Supabase local
bun run dev:shared        # Next contre le schéma wildcard_dev partagé
bun run build             # Build de production
bun run lint              # Lint Biome
bun run typecheck         # tsc --noEmit
bun run test              # Tests unitaires (Vitest)
bun run test:rls          # Test d'intégration RLS (Supabase local requis)

bun run db:new-migration -- <nom>   # Nouvelle migration
bun run db:reset          # Reset local (migrations + seed)
bun run db:types          # Types générés du schéma wildcard (à comparer à types.ts)
bun run db:apply:shared   # Appliquer les migrations à wildcard_dev (sur le serveur)
```

---

## Structure du projet

```
wildcard/
├── src/
│   ├── app/[lang]/           # Toutes les pages (i18n) — dont dev-login (dev only)
│   ├── dictionaries/         # fr.json (source de vérité) + en.json
│   ├── lib/
│   │   ├── auth/             # session (getClaims), bearer API, URLs du portal, rôles
│   │   ├── models/identities.ts  # pseudo/avatar via le portal
│   │   └── supabase/         # clients (schéma, cookie partagé), types
│   └── proxy.ts              # Refresh de session + maintenance + i18n
├── supabase/
│   ├── migrations/           # Migrations SQL (schéma `wildcard`)
│   ├── config.toml           # Supabase CLI (local)
│   └── seed.sql              # Comptes de dev
├── scripts/
│   ├── migrate.sh            # Runner de migrations (prod / wildcard_dev)
│   ├── docker-entrypoint.sh  # Migre puis démarre le serveur
│   ├── apply-shared.sh       # Migrations → wildcard_dev (serveur)
│   └── dev-up.sh             # Supabase local
└── deploy/                   # Stack serveur (compose, Caddy, Prometheus, Grafana)
```

---

## Base de données

Toutes les tables vivent dans le schéma **`wildcard`**, RLS activée partout.

| Table | Rôle |
|---|---|
| `profiles` | Ancre du joueur (1 ligne par compte) — identité au portal |
| `user_roles` | Rôle global (`user` / `moderator` / `admin`), écrit par le service role |
| `player_xp`, `player_elo`, `player_inventory`, `player_customizations` | Progression et cosmétiques |
| `rooms`, `room_players`, `games`, `game_actions` | Salons et parties (méta publique, Realtime) |
| `game_states` | État secret complet (mains, graine RNG) — **aucune policy**, service role uniquement |
| `eca_games`, `persistent_replays`, `matchmaking_tickets`, `app_settings` | Studio, replays, matchmaking, maintenance |

### Créer une migration

```bash
bun run db:new-migration -- <nom>     # supabase/migrations/<timestamp>_<nom>.sql
bun run dev:up                        # l'applique au Supabase local
```

Règles :

- Écrire avec le nom **`wildcard`** littéral, jamais `wildcard_dev` (le runner
  refuse) ; préfixer par `wildcard` tout nom partagé entre apps (trigger sur
  `auth.users`, bucket, policy sur `storage.objects`).
- Les fonctions `security definer` fixent `search_path`.
- Mettre à jour `src/lib/supabase/types.ts` (maintenu à la main pour typer
  finement les colonnes jsonb) en le comparant à `bun run db:types`.

#### Runner de migrations (`scripts/migrate.sh`)

En prod, l'**entrypoint du conteneur** applique les migrations avant de
démarrer le serveur (rôle `supabase_admin`, seul autorisé à poser un trigger
sur `auth.users` partagé). Chaque fichier est appliqué **au plus une fois**,
consigné dans `<schéma>.schema_migrations`, dans **une transaction** avec son
enregistrement et un **verrou consultatif** (deux conteneurs qui démarrent
ensemble n'appliquent jamais deux fois le même fichier). Une erreur SQL fait
échouer le démarrage : l'ancien conteneur continue de servir.

---

## Authentification

Gérée par le **portal** (`auth.wiibleyde.dev`) : email/mot de passe et Discord.

- Visiteur non connecté sur une page protégée → `auth.wiibleyde.dev/login?next=<URL Wildcard>`
  (le portal accepte tout `https://*.wiibleyde.dev`), retour connecté.
- Inscription : `auth.wiibleyde.dev/signup?next=…` ; mot de passe oublié :
  `auth.wiibleyde.dev/forgot` (le reset appartient au portal).
- Pseudo, photo de profil, amis, blocages, comptes liés : `auth.wiibleyde.dev/`
  (lien depuis le profil). Amis aussi gérables dans l'app (`/profile/friends`,
  via l'API du portal).
- Déconnexion : met fin à la session sur **toutes** les apps (cookie partagé).
- Admin : `update wildcard.user_roles set role = 'admin' where user_id = (select id from auth.users where email = '…');`

---

## Internationalisation

Locales : **`fr`** (défaut), `en`.

- `proxy.ts` détecte la locale via `Accept-Language` et redirige `/` → `/fr`
- Toutes les pages vivent sous `src/app/[lang]/`
- Dictionnaires dans `src/dictionaries/`

Ajouter une clé de traduction :
1. Ajouter dans `src/dictionaries/fr.json` ET `en.json`
2. TypeScript valide automatiquement (type `Dictionary` dérivé de `fr.json`)

---

## Monitoring & Analytics

L'observabilité (Umami + Prometheus + Grafana) est **mutualisée** sur l'infra
wiibleyde.dev — cf. **[`deploy/README.md`](deploy/README.md)** —, pas dans ce
dépôt. L'app garde deux points d'intégration : l'endpoint `/api/metrics`
(Prometheus) et le tag Umami.

### Métriques Prometheus exposées (`/api/metrics`)

`prom-client` expose un registre singleton (voir `src/lib/metrics/registry.ts`) :

- `wildcard_active_games{module}` — parties en cours (gauge, lu en base au scrape)
- `wildcard_move_duration_ms{module}` — latence serveur d'application d'un coup (histogram)
- `wildcard_moves_total{module,result}` — débit / erreurs des actions (counter)
- `wildcard_games_started_total{module}` / `wildcard_games_finished_total{module}` — démarrées vs terminées → **taux d'abandon**
- `wildcard_game_duration_seconds{module}` — durée d'une partie (histogram) → **durée moyenne par jeu**
- métriques Node/process (`wildcard_*` : CPU, heap, event-loop)

> **Accès protégé** — la route exige un `Authorization: Bearer <token>` égal à
> `METRICS_TOKEN`, que le Prometheus central présente (même valeur des deux
> côtés — cf. [`deploy/README.md`](deploy/README.md)). Sans `METRICS_TOKEN`,
> la route répond 404 (fermée par défaut).

### Dashboards Grafana

Les JSON vivent dans `deploy/grafana/dashboards/` ; le Grafana central les charge
(datasources d'`uid` `prometheus` + `umami-postgres`, cf.
[`deploy/README.md`](deploy/README.md)) :

- *Wildcard — Métier (jeux)* : parties actives, durée moyenne par jeu, taux
  d'abandon, latence des coups, débit/erreurs.
- *Wildcard — Analytics web (Umami)* : pages vues, sessions, top pages.
- *Sécurité (CrowdSec)* : bans actifs, scénarios déclenchés, parsing.

### Activer le tag Umami dans l'app

1. Ouvrir l'UI Umami central → créer un site « Wildcard » → copier son **Website ID**.
2. Le renseigner dans `UMAMI_WEBSITE_ID` (`.env` du serveur, ou `.env.local`
   pour `next dev`), redémarrer l'app.

Sans `UMAMI_WEBSITE_ID`, le tag ne se charge pas — aucun impact sur les runs
locaux.

> **Config publique au runtime** — `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
> `SUPABASE_SCHEMA`, `COOKIE_DOMAIN`, `APP_URL`, `PORTAL_URL`, `UMAMI_URL` et
> `UMAMI_WEBSITE_ID` ne sont **pas** des `NEXT_PUBLIC_*` : elles sont lues
> côté serveur à la requête et injectées au navigateur via `window.__PUBLIC_ENV__`
> (`src/lib/public-env.ts`). Une seule image construite par la CI tourne dans
> n'importe quel environnement — aucune valeur figée au build, donc aucun rebuild
> par déploiement.

> **RGPD** : Umami est cookieless et ne stocke aucune donnée personnelle (IP +
> user-agent hachés par jour → visiteur anonyme), donc pas de bannière de
> consentement. Toutes les données restent dans le Postgres de l'Umami auto-hébergé.

---

## Déploiement

Sur **rivendell**, comme les autres apps de l'infra : la stack vit dans
`~/infra/services/wildcard/` (copie de [`deploy/compose.yml`](deploy/compose.yml)
+ `.env`), derrière le Caddy partagé. Mise en place pas à pas (schémas,
PostgREST, Caddy, Prometheus, Grafana, Umami) : **[`deploy/README.md`](deploy/README.md)**.

```bash
cd ~/infra/services/wildcard
docker compose pull && docker compose up -d     # migrations appliquées au démarrage
WILDCARD_TAG=sha-<commit> docker compose up -d  # rollback sur un commit précis
```

---

## Intégration & déploiement continus (CI/CD)

| Workflow | Fichier | Déclencheur | Rôle |
|---|---|---|---|
| **CI** | `.github/workflows/ci.yml` | push `main`, toute PR | lint (Biome) · tests (Vitest) · build Next |
| **CD** | `.github/workflows/cd.yml` | CI vert sur `main` · tag `v*` · manuel | build + push image GHCR · déploiement (optionnel) |

**Build once, deploy by pull** : l'image ne contient aucune config publique
(tout est lu au runtime), donc un **seul artefact** `ghcr.io/wiibleyde/wildcard`
(tags `latest`, `sha-<commit>`, semver sur tag `v*`) tourne partout.

Le job `deploy` est **dormant** tant que la variable `DEPLOY_ENABLED` n'est pas
à `true`. Pour l'activer (**GitHub → Settings → Secrets and variables → Actions**) :

| Type | Nom | Valeur |
|---|---|---|
| Variable | `DEPLOY_ENABLED` | `true` |
| Secret | `DEPLOY_HOST` | `rivendell` (IP / domaine) |
| Secret | `DEPLOY_USER` | utilisateur SSH |
| Secret | `DEPLOY_SSH_KEY` | clé privée SSH (sans passphrase) |
| Secret | `DEPLOY_PATH` | `/home/wiibleyde/infra/services/wildcard` |

Le job se connecte en SSH, `docker compose pull && up -d` : le nouveau conteneur
migre le schéma puis démarre.
