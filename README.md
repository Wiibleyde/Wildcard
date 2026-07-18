# Wildcard

Plateforme de jeux de cartes multijoueur en ligne — projet de fin d'études Master.

**Stack** : Next.js 16 · React 19 · TypeScript strict · Tailwind CSS · Supabase (PostgreSQL, Auth, Realtime, RLS)

---

## Prérequis

| Outil | Version minimale | Installation |
|---|---|---|
| Node.js | 20+ | [nodejs.org](https://nodejs.org) |
| Bun | 1.0+ | `npm install -g bun` |
| Docker | 24+ | [docker.com](https://www.docker.com) |
| Supabase CLI | 2.0+ | `bun install -g supabase` |

---

## Installation

```bash
git clone <repo-url>
cd wildcard
bun install
```

---

## Démarrage local

### 1 — Variables d'environnement

```bash
# Base de données et stack Supabase (Docker Compose)
cp .env.docker.example .env.docker
# → Remplir JWT_SECRET, POSTGRES_PASSWORD, LOGFLARE_API_KEY

# Application Next.js
cp .env.local.example .env.local
# → Remplir SUPABASE_URL et SUPABASE_ANON_KEY (lues au runtime)
#   (valeurs disponibles après l'étape 2)
```

Générer les clés JWT :
```bash
# JWT_SECRET : chaîne aléatoire ≥ 32 caractères
openssl rand -base64 32

# ANON_KEY et SERVICE_ROLE_KEY : JWTs signés avec JWT_SECRET
# → https://supabase.com/docs/guides/self-hosting/docker#generate-api-keys
```

### 2 — Démarrer la stack Supabase (Docker)

```bash
bun run db:start
# → Lance : PostgreSQL, Auth, PostgREST, Realtime, Storage, Studio, Kong…
```

Services disponibles (profil minimal) :
| Service | URL |
|---|---|
| API Supabase (Kong) | http://localhost:54321 |
| Postgres | localhost:5432 |
| Inbucket (emails) | http://localhost:54324 |

Pour lancer avec Studio (dashboard) et Storage :
```bash
docker compose --env-file .env.docker --profile studio up -d
# → ajoute Studio sur http://localhost:54323
```

### 3 — Appliquer les migrations

```bash
# Lier le projet local (première fois)
supabase link --project-ref <ref>   # ou travailler uniquement en local

# Appliquer les migrations sur la stack locale
bun run db:push
# ou réinitialiser complètement (+ seed)
bun run db:reset
```

### 4 — Générer les types TypeScript

**Obligatoire après chaque modification de schéma.**

```bash
bun run db:types
# → supabase gen types typescript --local > src/lib/supabase/types.ts
```

### 5 — Lancer le serveur de développement

```bash
bun run dev
# → http://localhost:3000  (redirige automatiquement vers /fr)
```

---

## Commandes utiles

```bash
bun run dev               # Serveur Next.js (Turbopack)
bun run build             # Build de production
bun run lint              # Lint Biome
bun run format            # Format Biome

bun run db:start          # Démarrer la stack Docker Supabase
bun run db:stop           # Arrêter la stack Docker
bun run db:push           # Appliquer les migrations
bun run db:reset          # Reset DB + migrations + seed
bun run db:types          # Regénérer src/lib/supabase/types.ts
bun run db:new-migration  # Créer une nouvelle migration
#   ex : bun run db:new-migration -- add_game_state
```

---

## Structure du projet

```
wildcard/
├── src/
│   ├── app/
│   │   ├── [lang]/           # Toutes les pages (i18n)
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   └── auth/callback/    # Callback OAuth (hors [lang])
│   ├── dictionaries/
│   │   ├── fr.json           # Traductions FR (source de vérité)
│   │   └── en.json
│   ├── lib/
│   │   ├── i18n.ts           # getDictionary, Locale, Dictionary
│   │   └── supabase/
│   │       ├── client.ts     # Client navigateur
│   │       ├── server.ts     # Client Server Components / API Routes
│   │       ├── auth.ts       # signInWithOAuth (Discord/Google), signOut
│   │       └── types.ts      # Types DB (auto-généré)
│   └── proxy.ts              # Session refresh Supabase + redirect i18n
├── supabase/
│   ├── migrations/           # Migrations SQL versionnées
│   ├── config.toml           # Config Supabase CLI
│   ├── kong.yml              # Config API Gateway
│   └── seed.sql              # Données de dev
├── docker-compose.yml        # Stack Supabase complète
├── .env.docker.example       # Variables Docker Compose
└── .env.local.example        # Variables Next.js
```

---

## Base de données

### Schéma

| Table | Description |
|---|---|
| `profiles` | Profil joueur lié à `auth.users` |

### RLS (Row Level Security)

- **`profiles`** : lecture publique, écriture/mise à jour par le propriétaire uniquement
- Un trigger `on_auth_user_created` crée automatiquement un profil à l'inscription (compatible Discord, Google, email)

### Créer une migration

```bash
bun run db:new-migration -- <nom>
# → crée supabase/migrations/<timestamp>_<nom>.sql
# Éditer le fichier, puis appliquer :
bun run db:migrate        # n'applique QUE les fichiers non encore appliqués
bun run db:types          # regénérer les types TypeScript
```

#### Suivi des versions (`schema_migrations`)

`bun run db:migrate` lance `supabase/migrate.sh` (service `db-migrate`). Chaque
fichier est appliqué **au plus une fois** : la version (nom de fichier) est
enregistrée dans `public.schema_migrations`. Re-lancer = no-op, plus de mur
d'erreurs « already exists ».

- Chaque migration tourne dans **une transaction** (`ON_ERROR_STOP`) : une vraie
  erreur SQL annule le fichier et **interrompt le run** (exit ≠ 0) — un échec
  casse le déploiement au lieu d'être masqué.
- **Bootstrap** : sur une base déjà au niveau HEAD mais sans historique (table
  `profiles` présente, `schema_migrations` vide), tous les fichiers actuels sont
  marqués appliqués **sans être rejoués** (baseline). Une base vierge applique
  tout normalement.

---

## Authentification

Providers OAuth configurés : **Discord**, **Google**.

Activer un provider :
1. Créer l'app dans la console du provider
2. URL de redirection à enregistrer : `http://localhost:54321/auth/v1/callback` (local) ou `https://<ref>.supabase.co/auth/v1/callback` (prod)
3. Renseigner `CLIENT_ID` et `SECRET` dans `.env.docker`
4. Passer le flag `ENABLE_<PROVIDER>_SIGNUP=true` dans `.env.docker`

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

Stack 100 % open source, self-host, RGPD-compliant. Trois services, profil
Docker `monitoring` :

| Service        | Rôle                                            | URL locale              |
| -------------- | ----------------------------------------------- | ----------------------- |
| **Umami**      | Analytics web cookieless (pages vues, sessions) | http://localhost:54325  |
| **Prometheus** | Métriques applicatives (scrape `/api/metrics`)  | http://localhost:54326  |
| **Grafana**    | Visualisation unifiée des deux sources          | http://localhost:54327  |

```bash
# Renseigner d'abord la section monitoring de .env.docker
docker compose --env-file .env.docker --profile monitoring up -d
```

### Métriques Prometheus exposées (`/api/metrics`)

`prom-client` expose un registre singleton (voir `src/lib/metrics/registry.ts`) :

- `wildcard_active_games{module}` — parties en cours (gauge, lu en base au scrape)
- `wildcard_move_duration_ms{module}` — latence serveur d'application d'un coup (histogram)
- `wildcard_moves_total{module,result}` — débit / erreurs des actions (counter)
- `wildcard_games_started_total{module}` / `wildcard_games_finished_total{module}` — démarrées vs terminées → **taux d'abandon**
- `wildcard_game_duration_seconds{module}` — durée d'une partie (histogram) → **durée moyenne par jeu**
- métriques Node/process (`wildcard_*` : CPU, heap, event-loop)

> **Accès protégé** — le port de l'app est publié, donc `/api/metrics` est
> joignable de l'extérieur. Définir `METRICS_TOKEN` (`.env.docker`) : la route
> exige alors un `Authorization: Bearer <token>`, que Prometheus envoie
> automatiquement. Laissé vide en dev local (pas de Prometheus), la route reste
> ouverte.

### Grafana

Datasources et dashboards **provisionnés** au démarrage (`monitoring/grafana/`) :

- **Prometheus** + **Umami (PostgreSQL)** — les deux sources.
- Dashboard *Wildcard — Métier (jeux)* : parties actives, durée moyenne par jeu,
  taux d'abandon, latence des coups, débit/erreurs.
- Dashboard *Wildcard — Analytics web (Umami)* : pages vues, sessions, top pages.

Login admin : `GRAFANA_ADMIN_USER` / `GRAFANA_ADMIN_PASSWORD` (`.env.docker`).

### Activer le tag Umami dans l'app

1. Ouvrir Umami (http://localhost:54325), login par défaut `admin` / `umami`.
2. Créer un site « Wildcard » → copier son **Website ID**.
3. Coller dans `.env.docker` (ou `.env.local` pour `next dev`) → `UMAMI_WEBSITE_ID`,
   redémarrer l'app.

Sans `UMAMI_WEBSITE_ID`, le tag ne se charge pas — aucun impact sur les runs
locaux sans monitoring.

> **Config publique au runtime** — `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `UMAMI_URL`
> et `UMAMI_WEBSITE_ID` ne sont **pas** des `NEXT_PUBLIC_*` : elles sont lues
> côté serveur à la requête et injectées au navigateur via `window.__PUBLIC_ENV__`
> (`src/lib/public-env.ts`). Une seule image construite par la CI tourne dans
> n'importe quel environnement — aucune valeur figée au build, donc aucun rebuild
> par déploiement.

> **RGPD** : Umami est cookieless et ne stocke aucune donnée personnelle (IP +
> user-agent hachés par jour → visiteur anonyme), donc pas de bannière de
> consentement. Toutes les données restent dans notre propre Postgres (`umami-db`).

---

## Déploiement — On-Premise (tout Docker)

L'application Next.js et la stack Supabase tournent dans le même `docker compose`.
Un seul serveur, un seul `docker compose up`.

### Prérequis serveur

| Ressource | Minimum |
|---|---|
| CPU | 2 vCPU |
| RAM | 4 Go |
| Disque | 20 Go SSD |
| OS | Ubuntu 22.04+ |
| Ports ouverts | 22 (SSH), 80, 443 |

> **Seuls 80/443 (Caddy) et 22 (SSH) doivent être joignables de l'extérieur.**
> Les ports internes publiés par compose — app `3000`, Kong `54321/54322`, et les
> ports d'admin (`54323`, `54325-27`) — ne doivent **pas** être exposés : sinon on
> contourne Caddy **et** le filtrage CrowdSec. Cf. « Durcissement réseau » ci-dessous.

```bash
# Docker (si pas installé)
curl -fsSL https://get.docker.com | sh && sudo usermod -aG docker $USER
```

### 1 — Cloner et configurer

```bash
git clone <repo-url> /opt/wildcard
cd /opt/wildcard
cp .env.docker.example .env.docker
```

Remplir `.env.docker` — variables critiques :

```bash
# Secrets (générer avec : openssl rand -hex 32)
POSTGRES_PASSWORD=<secret>
JWT_SECRET=<secret-32-chars-min>
SECRET_KEY_BASE=<secret>

# ANON_KEY et SERVICE_ROLE_KEY : JWTs HS256 signés avec JWT_SECRET
# Générer sur : https://supabase.com/docs/guides/self-hosting/docker#generate-api-keys
ANON_KEY=<jwt-anon>
SERVICE_ROLE_KEY=<jwt-service-role>

# URLs publiques (domaine ou IP du serveur)
SITE_URL=https://wildcard.example.com
API_EXTERNAL_URL=https://api.wildcard.example.com
SUPABASE_PUBLIC_URL=https://api.wildcard.example.com
ADDITIONAL_REDIRECT_URLS=https://wildcard.example.com/auth/callback
```

### 2 — Lancer toute la stack

```bash
docker compose --env-file .env.docker up -d --build
```

Ce que fait ce seul `up` :
1. Build l'image Next.js (aucune config publique figée — lue au runtime via l'env du conteneur)
2. Démarre PostgreSQL, Auth, REST, Realtime, Kong, Inbucket
3. Applique les migrations (`db-migrate` one-shot)
4. Lance l'app Next.js

Vérifier :
```bash
docker compose --env-file .env.docker ps
# → tous les services : Up (healthy)
```

### 3 — Reverse proxy Caddy (profil `proxy`)

Le reverse proxy est **conteneurisé** : le service `caddy` (profil `proxy` dans
`docker-compose.yml`) est le point d'entrée HTTPS unique. Il termine TLS avec des
certificats **Let's Encrypt émis et renouvelés automatiquement** — pas de certbot
à piloter à la main — et route vers l'app et l'API Supabase par leur **nom de
service** sur le réseau Docker. Caddy gère nativement l'upgrade WebSocket
(Realtime) et pose les en-têtes `X-Forwarded-*`.

Renseigner les domaines dans `.env.docker` (leurs DNS `A`/`AAAA` doivent pointer
vers le serveur) :

```bash
# Dans .env.docker :
APP_DOMAIN=wildcard.example.com
API_DOMAIN=api.wildcard.example.com
ACME_EMAIL=admin@example.com      # notifications Let's Encrypt
```

La config vit dans [`caddy/Caddyfile`](caddy/Caddyfile) :

```caddyfile
{
    email {$ACME_EMAIL}
}

{$APP_DOMAIN} {
    encode zstd gzip
    reverse_proxy app:3000
}

{$API_DOMAIN} {
    encode zstd gzip
    reverse_proxy kong:8000    # WebSocket Realtime proxifié automatiquement
}
```

Lancer la stack **avec** le proxy (ouvre les ports 80/443 de l'hôte) :

```bash
docker compose --env-file .env.docker --profile proxy up -d
```

> Les certificats sont persistés dans le volume `caddy-data` : ne pas le
> supprimer (rate-limit Let's Encrypt = 5 certs / domaine / semaine).

#### CrowdSec — protection du reverse proxy (IPS)

Le proxy est protégé par **CrowdSec**, un IPS collaboratif. Deux moitiés qui
forment une boucle fermée :

- **Détection** — l'agent CrowdSec parse les access logs JSON de Caddy (volume
  partagé `caddy-logs`) et applique les scénarios de la collection
  `crowdsecurity/caddy` (scan, brute-force, CVE HTTP…). Une attaque crée une
  **décision** de ban en base.
- **Remédiation** — le binaire Caddy est **recompilé** (`caddy/Dockerfile`, via
  `xcaddy`) avec le bouncer `hslatman/caddy-crowdsec-bouncer`. Le handler
  `crowdsec` interroge la LAPI à chaque requête et **bloque** les IP sous
  décision. L'image `caddy:2-alpine` stock ne suffit pas — d'où le `build:`.

L'agent et le bouncer partagent une clé (`CROWDSEC_API_KEY`) : l'agent
l'auto-enregistre au démarrage (`BOUNCER_KEY_CADDY`), le bouncer la présente en
`X-Api-Key`. Aucune étape manuelle.

```bash
# Dans .env.docker — générer la clé :
CROWDSEC_API_KEY=$(openssl rand -hex 32)
```

Le premier `up --profile proxy` **compile** le binaire Caddy (une minute, réseau
requis). Vérifier après démarrage :

```bash
docker exec wildcard-crowdsec cscli metrics       # parsing + scénarios
docker exec wildcard-crowdsec cscli decisions list # bans actifs
docker exec wildcard-crowdsec cscli bouncers list  # le bouncer `caddy` = valid
```

**Web UI = Grafana**, pas de nouveau service. L'agent expose ses métriques
Prometheus sur `:6060` (basculé sur `0.0.0.0` via `crowdsec/config.yaml.local`) ;
le profil `monitoring` les scrape et provisionne le dashboard **« Sécurité
(CrowdSec) »** (bans actifs, scénarios déclenchés, parsing). Le Metabase de
`cscli dashboard` est déprécié (retiré en CrowdSec 1.7.0) — on réutilise la stack
Grafana existante.

```bash
# Proxy + protection + UI :
docker compose --env-file .env.docker --profile proxy --profile monitoring up -d
# → Grafana sur http://localhost:54327, dashboard « Sécurité (CrowdSec) »
```

#### Durcissement réseau (pare-feu)

Caddy est le **seul point d'entrée** : tout le trafic doit y passer pour être
filtré par CrowdSec. Or `docker-compose.yml` publie les ports internes (app
`3000`, Kong `54321`) sur l'hôte — pratique en dev local, **trou de sécurité en
prod** : une IP bannie peut frapper `http://serveur:3000` en direct et contourner
l'IPS.

> ⚠️ **Piège Docker + ufw** : Docker insère ses règles iptables **avant** celles
> d'ufw. Un `ufw deny 3000` ne bloque donc **pas** un port publié par Docker. Ne
> pas se reposer sur ufw seul pour ces ports.

**Correctif propre — republier les ports internes en loopback.** Le repo fournit
`docker-compose.prod.yml`, un override qui rebinde app / Kong / dashboards sur
`127.0.0.1`. Caddy joint toujours l'app et Kong par le réseau compose
(`app:3000`, `kong:8000`), donc ces ports n'ont pas besoin d'être exposés :

```yaml
# docker-compose.prod.yml (extrait) — le tag !override REMPLACE la liste ports du
# fichier de base ; sans lui, Compose FUSIONNE et le mapping 0.0.0.0 subsisterait.
services:
  app:
    ports: !override
      - "127.0.0.1:3000:3000"
  kong:
    ports: !override
      - "127.0.0.1:${KONG_HTTP_PORT}:8000/tcp"
      - "127.0.0.1:${KONG_HTTPS_PORT}:8443/tcp"
```

Lancer la prod avec l'override empilé sur le fichier de base :

```bash
docker compose --env-file .env.docker \
  -f docker-compose.yml -f docker-compose.prod.yml \
  --profile proxy --profile monitoring up -d
```

> **Recommandé en prod — rendre l'override + les profils implicites.** Ajouter ces
> deux lignes à `.env.docker` sur le serveur : Compose les lit nativement, donc
> **toutes** les commandes (y compris `scripts/deploy.sh`) chargent l'override et
> les profils sans `-f`/`--profile`. Sans ça, un `deploy.sh` qui recrée `app`
> republie le port sur `0.0.0.0` et **rouvre le trou**.
>
> ```bash
> # .env.docker (serveur de prod uniquement — NE PAS mettre en dev local)
> COMPOSE_FILE=docker-compose.yml:docker-compose.prod.yml
> COMPOSE_PROFILES=proxy,monitoring
> ```
>
> Ensuite un simple `docker compose --env-file .env.docker up -d` suffit.

**Pare-feu de base** (défense en profondeur, en plus du loopback) :

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # Caddy — redirige vers 443
sudo ufw allow 443/tcp   # Caddy — HTTPS
sudo ufw enable
```

Les dashboards d'admin (Studio, Grafana, Umami) restent en loopback : y accéder
via un **tunnel SSH** (`ssh -L 54327:localhost:54327 serveur`) plutôt qu'en les
exposant.

### 4 — OAuth en production

URL de redirection à enregistrer dans chaque console provider :

```
https://api.wildcard.example.com/auth/v1/callback
```

| Provider | Console |
|---|---|
| Discord | discord.com/developers |
| Google | console.cloud.google.com/apis/credentials |

Activer dans `.env.docker` puis redémarrer auth :

```bash
# Dans .env.docker :
ENABLE_DISCORD_SIGNUP=true
SUPABASE_AUTH_DISCORD_CLIENT_ID=<id>
SUPABASE_AUTH_DISCORD_SECRET=<secret>

docker compose --env-file .env.docker restart auth
```

### 5 — Nouvelles migrations

```bash
# Créer la migration
bun run db:new-migration -- <nom>
# Éditer supabase/migrations/<timestamp>_<nom>.sql

# Appliquer en prod — le runner versionné n'applique que les fichiers nouveaux.
docker compose --env-file .env.docker run --rm db-migrate
```

> En CD, `scripts/deploy.sh` lance déjà cette étape à chaque déploiement
> (cf. *Déploiement continu*). Un fichier déjà appliqué est ignoré.

### 6 — Mise à jour de l'application

```bash
cd /opt/wildcard
git pull
docker compose --env-file .env.docker up -d --build app
# → rebuild uniquement le container Next.js, services Supabase non touchés
```

### Surveillance

```bash
docker compose --env-file .env.docker ps                    # état
docker compose --env-file .env.docker logs -f app           # logs app
docker compose --env-file .env.docker logs -f auth          # logs auth
docker compose --env-file .env.docker restart <service>     # redémarrer un service
```

### Reset complet (⚠️ supprime toutes les données)

```bash
docker compose --env-file .env.docker down -v
docker compose --env-file .env.docker up -d --build
```

---

## Intégration & déploiement continus (CI/CD)

Deux workflows GitHub Actions, séparés par responsabilité :

| Workflow | Fichier | Déclencheur | Rôle |
|---|---|---|---|
| **CI** | `.github/workflows/ci.yml` | push `main`, toute PR | lint (Biome) · tests (Vitest) · build Next |
| **CD** | `.github/workflows/cd.yml` | CI vert sur `main` · tag `v*` · manuel | build + push image GHCR · déploiement (optionnel) |

### Principe — *build once, deploy by pull*

L'image est **sans config publique** : `SUPABASE_URL`, `ANON_KEY`, `UMAMI_*` sont
lues au **runtime** depuis l'env du conteneur (cf. `Dockerfile`). Un **seul
artefact** tourne donc dans n'importe quel environnement. La pipeline le build
une fois, le publie sur **GHCR**, et le serveur le récupère par `docker pull` —
aucune reconstruction côté serveur.

1. **CI** valide le commit (lint + test + build).
2. À CI vert sur `main`, **CD** build l'image et la pousse sur
   `ghcr.io/wiibleyde/wildcard` (tags `latest` + `sha-<commit>`). Les tags Git
   `v1.2.3` produisent en plus une image semver immuable.
3. Le job `deploy` se connecte en SSH au serveur, `pull` la nouvelle image,
   applique les migrations et redémarre le conteneur app (`scripts/deploy.sh`).

> **État actuel : pas de serveur.** Le job `deploy` est **dormant** (gardé par la
> variable `DEPLOY_ENABLED`). Sans serveur, CD se contente de **builder et
> publier l'image** à chaque merge sur `main` — déjà fonctionnel et vérifiable
> dans l'onglet *Packages* du dépôt.

### Activer le déploiement (quand le serveur existe)

1. **Préparer le serveur** une fois (cf. *Déploiement — On-Premise* ci-dessus) :
   cloner dans `/opt/wildcard`, remplir `.env.docker`, `up -d --build` initial.
2. Dans `.env.docker` du serveur, pointer l'image publiée :
   ```bash
   APP_IMAGE=ghcr.io/wiibleyde/wildcard:latest
   ```
3. Dans **GitHub → Settings → Secrets and variables → Actions** :

   | Type | Nom | Valeur |
   |---|---|---|
   | Variable | `DEPLOY_ENABLED` | `true` |
   | Secret | `DEPLOY_HOST` | IP / domaine du serveur |
   | Secret | `DEPLOY_USER` | utilisateur SSH |
   | Secret | `DEPLOY_SSH_KEY` | clé privée SSH (sans passphrase) |
   | Secret | `DEPLOY_PATH` | `/opt/wildcard` |

   `GITHUB_TOKEN` (auto) sert à `docker login ghcr.io` côté serveur — aucun PAT à
   gérer. (Alternative : se logger une fois sur le serveur avec un PAT et retirer
   la ligne `docker login` du workflow.)

À partir de là, chaque merge sur `main` (CI vert) déploie tout seul.

### Déploiement / rollback manuel

Sur le serveur, `scripts/deploy.sh` fait le pull + migrations + restart :

```bash
cd /opt/wildcard && git pull
./scripts/deploy.sh                 # déploie APP_IMAGE (ex. :latest)
./scripts/deploy.sh sha-<commit>    # rollback sur un commit précis
```
