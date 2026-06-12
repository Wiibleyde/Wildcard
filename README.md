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
# → Remplir NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY
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
│   │       ├── auth.ts       # signInWithOAuth (Discord/Google/Apple), signOut
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
- Un trigger `on_auth_user_created` crée automatiquement un profil à l'inscription (compatible Discord, Google, Apple, email)

### Créer une migration

```bash
bun run db:new-migration -- <nom>
# → crée supabase/migrations/<timestamp>_<nom>.sql
# Éditer le fichier, puis : bun run db:push
# Regénérer les types : bun run db:types
```

---

## Authentification

Providers OAuth configurés : **Discord**, **Google**, **Apple**.

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
1. Build l'image Next.js avec `NEXT_PUBLIC_SUPABASE_URL=API_EXTERNAL_URL`
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
| Apple | developer.apple.com/account/resources/identifiers |

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

# Appliquer en prod (service db-migrate est one-shot, relancer manuellement)
PGPASSWORD=$(grep POSTGRES_PASSWORD .env.docker | cut -d= -f2) \
  psql -h localhost -U postgres -d postgres \
  -f supabase/migrations/<timestamp>_<nom>.sql
```

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
