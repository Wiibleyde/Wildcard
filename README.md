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
| Ports ouverts | 80, 443 |

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

### 3 — Nginx + SSL (reverse proxy)

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

Créer `/etc/nginx/sites-available/wildcard` :

```nginx
# API Supabase (Kong + WebSocket Realtime)
server {
    server_name api.wildcard.example.com;
    location / {
        proxy_pass         http://localhost:54321;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade    $http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host       $host;
        proxy_set_header   X-Real-IP  $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
}

# Application Next.js
server {
    server_name wildcard.example.com;
    location / {
        proxy_pass       http://localhost:3000;
        proxy_set_header Host             $host;
        proxy_set_header X-Real-IP        $remote_addr;
        proxy_set_header X-Forwarded-For  $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/wildcard /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# SSL automatique via Let's Encrypt
sudo certbot --nginx -d wildcard.example.com -d api.wildcard.example.com
```

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
