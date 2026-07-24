# Déploiement — stack edge & observabilité (mutualisée)

Le reverse proxy (**Caddy**), l'IPS (**CrowdSec**) et l'observabilité
(**Prometheus**, **Grafana**, **Umami**) **ne vivent plus dans ce dépôt**. Ce
sont des briques d'infrastructure génériques, réutilisables par n'importe quel
projet — les faire tourner par-application les dupliquerait et se battrait pour
les ports `:80/:443`.

Elles tournent donc **une seule fois**, dans une stack centrale séparée qui
fronte tous les projets. Wildcard n'embarque que ses **fragments** :

| Fragment (dans ce dépôt)                     | Rôle                                              |
| -------------------------------------------- | ------------------------------------------------- |
| `deploy/caddy/wildcard.caddy`                | Blocs de site Caddy (domaines → app / Kong)       |
| `deploy/prometheus/wildcard.yml`             | Job de scrape de `/api/metrics`                   |
| `deploy/grafana/dashboards/wildcard-*.json`  | Dashboards métier (jeux) + analytics web (Umami)  |
| `deploy/grafana/dashboards/crowdsec.json`    | Dashboard sécurité CrowdSec (générique)           |

L'app expose toujours `/api/metrics` (prom-client) et le tag Umami — seuls les
**collecteurs/afficheurs** partent en central.

---

## Architecture

```
                          ┌──────────────────────────── réseau docker « edge » (externe) ─────────────┐
  Internet ──80/443──▶ Caddy (central) ──┬─▶ wildcard-app:3000   (app Next.js)                          │
                          │  + CrowdSec   └─▶ wildcard-kong:8000  (gateway Supabase)                     │
                          │                                                                             │
  Prometheus (central) ──scrape──────────────▶ wildcard-app:3000/api/metrics                            │
                          └──────────────────────────────────────────────────────────────────────────┘
  Grafana (central) ◀── Prometheus + Umami(PostgreSQL)      Umami (central) ◀── tag navigateur de l'app
```

- **Réseau `edge`** : réseau Docker **externe** partagé. Les services de Wildcard
  qui doivent être joignables par la stack centrale (`app`, `kong`) y sont
  attachés avec des **alias stables** (`wildcard-app`, `wildcard-kong`) — voir le
  `docker-compose.yml` de Wildcard. La stack centrale y attache Caddy/Prometheus.
  Aucun port hôte n'est publié pour ce chemin.
- **Alias, pas nom de service** : plusieurs projets ont un service `app` ; sur un
  réseau partagé le nom collisionnerait. D'où le préfixe `wildcard-*`.

### Prérequis (une fois par serveur)

```bash
docker network create edge
```

---

## 1 — Stack centrale (à copier hors de ce dépôt, ex. `/opt/edge`)

> Copier ce compose et ses fichiers de config dans un dépôt/dossier
> d'infrastructure séparé. Il est **indépendant de Wildcard** et fronte tous les
> projets qui rejoignent le réseau `edge`.

`docker-compose.yml` (central) :

```yaml
name: edge

networks:
  edge:
    external: true

volumes:
  caddy-data:
  caddy-config:
  caddy-logs:
  crowdsec-db:
  prometheus-data:
  grafana-data:
  umami-db-data:

services:
  # ── Reverse proxy — point d'entrée HTTPS unique ────────────────────────────
  caddy:
    build: ./caddy            # Caddy recompilé avec le bouncer CrowdSec (cf. plus bas)
    image: edge-caddy:local
    restart: unless-stopped
    depends_on: [crowdsec]
    networks: [edge]
    ports:
      - "80:80"
      - "443:443"
      - "443:443/udp"        # HTTP/3 (QUIC)
    environment:
      ACME_EMAIL: ${ACME_EMAIL}
      CROWDSEC_API_KEY: ${CROWDSEC_API_KEY}
      # Domaines de Wildcard (consommés par le fragment importé) :
      WILDCARD_APP_DOMAIN: ${WILDCARD_APP_DOMAIN}
      WILDCARD_API_DOMAIN: ${WILDCARD_API_DOMAIN}
    volumes:
      - ./caddy/Caddyfile:/etc/caddy/Caddyfile:ro
      - ./caddy/sites:/etc/caddy/sites:ro        # y déposer wildcard.caddy (+ autres projets)
      - caddy-data:/data                          # certificats — À PERSISTER
      - caddy-config:/config
      - caddy-logs:/var/log/caddy                 # access logs JSON lus par CrowdSec

  # ── IPS — parse les logs Caddy, publie des décisions de ban ────────────────
  crowdsec:
    image: crowdsecurity/crowdsec:latest
    restart: unless-stopped
    networks: [edge]
    environment:
      COLLECTIONS: "crowdsecurity/caddy crowdsecurity/http-cve crowdsecurity/whitelist-good-actors"
      BOUNCER_KEY_CADDY: ${CROWDSEC_API_KEY}     # auto-enregistre le bouncer `caddy`
    volumes:
      - crowdsec-db:/var/lib/crowdsec/data        # décisions/clés — À PERSISTER
      - ./crowdsec/acquis.yaml:/etc/crowdsec/acquis.yaml:ro
      - ./crowdsec/config.yaml.local:/etc/crowdsec/config.yaml.local:ro
      - caddy-logs:/var/log/caddy:ro

  # ── Métriques applicatives ─────────────────────────────────────────────────
  prometheus:
    image: prom/prometheus:v2.54.1
    restart: unless-stopped
    networks: [edge]
    environment:
      METRICS_TOKEN: ${METRICS_TOKEN}             # même valeur que côté Wildcard
    volumes:
      - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus-data:/prometheus
    # Prometheus ne lit pas l'env : on matérialise le token dans le fichier
    # référencé par `credentials_file` du job wildcard-app.
    entrypoint:
      - /bin/sh
      - -c
      - |
        printf '%s' "$$METRICS_TOKEN" > /etc/prometheus/wildcard-token
        exec /bin/prometheus \
          --config.file=/etc/prometheus/prometheus.yml \
          --storage.tsdb.path=/prometheus \
          --storage.tsdb.retention.time=30d
    ports:
      - "127.0.0.1:9090:9090"                     # loopback — accès par tunnel SSH

  # ── Analytics web cookieless ───────────────────────────────────────────────
  umami-db:
    image: postgres:15-alpine
    restart: unless-stopped
    networks: [edge]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U umami -d umami"]
      interval: 5s
      timeout: 5s
      retries: 10
    environment:
      POSTGRES_DB: umami
      POSTGRES_USER: umami
      POSTGRES_PASSWORD: ${UMAMI_DB_PASSWORD}
    volumes:
      - umami-db-data:/var/lib/postgresql/data

  umami:
    image: ghcr.io/umami-software/umami:postgresql-latest
    restart: unless-stopped
    networks: [edge]
    depends_on:
      umami-db:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql://umami:${UMAMI_DB_PASSWORD}@umami-db:5432/umami
      DATABASE_TYPE: postgresql
      APP_SECRET: ${UMAMI_APP_SECRET}
    ports:
      - "127.0.0.1:54325:3000"                    # loopback — front derrière Caddy si besoin

  # ── Visualisation unifiée (Prometheus + Umami) ─────────────────────────────
  grafana:
    image: grafana/grafana:11.2.0
    restart: unless-stopped
    networks: [edge]
    depends_on: [prometheus, umami-db]
    environment:
      GF_SECURITY_ADMIN_USER: ${GRAFANA_ADMIN_USER}
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_ADMIN_PASSWORD}
      GF_USERS_ALLOW_SIGN_UP: "false"
      UMAMI_DB_PASSWORD: ${UMAMI_DB_PASSWORD}     # interpolé par la datasource PostgreSQL
    volumes:
      - ./grafana/provisioning:/etc/grafana/provisioning:ro
      # Monter les dashboards de CE dépôt (ou les y copier) :
      - ../wildcard/deploy/grafana/dashboards:/var/lib/grafana/dashboards:ro
      - grafana-data:/var/lib/grafana
    ports:
      - "127.0.0.1:54327:3000"                    # loopback — accès par tunnel SSH
```

### Fichiers de config du central

**`caddy/Dockerfile`** — Caddy recompilé avec le bouncer CrowdSec (le module
n'est pas dans l'image stock) :

```dockerfile
ARG CADDY_VERSION=2
FROM caddy:${CADDY_VERSION}-builder-alpine AS builder
RUN xcaddy build \
    --with github.com/hslatman/caddy-crowdsec-bouncer/http@v0.13.1
FROM caddy:${CADDY_VERSION}-alpine
COPY --from=builder /usr/bin/caddy /usr/bin/caddy
```

**`caddy/Caddyfile`** — blocs globaux + import des fragments par projet :

```caddyfile
{
	email {$ACME_EMAIL}

	# Client LAPI partagé par tous les handlers `crowdsec`.
	crowdsec {
		api_url http://crowdsec:8080
		api_key {$CROWDSEC_API_KEY}
		ticker_interval 15s
	}
}

# Snippet réutilisable : access log JSON vers le volume lu par CrowdSec.
(access_log) {
	log {
		output file /var/log/caddy/access.log {
			roll_size 30MiB
			roll_keep 5
		}
		format json
	}
}

# Chaque projet dépose son fragment dans ./caddy/sites/*.caddy
import /etc/caddy/sites/*.caddy
```

> Déposer `deploy/caddy/wildcard.caddy` (ce dépôt) dans `./caddy/sites/` du
> central. Il utilise le handler `crowdsec` et `import access_log` définis ici.

**`crowdsec/acquis.yaml`** :

```yaml
filenames:
  - /var/log/caddy/*.log
labels:
  type: caddy
```

**`crowdsec/config.yaml.local`** (expose les métriques CrowdSec à Prometheus) :

```yaml
prometheus:
  enabled: true
  level: full
  listen_addr: 0.0.0.0
  listen_port: 6060
```

**`prometheus/prometheus.yml`** — global + CrowdSec + self + **le job Wildcard**
(copié depuis `deploy/prometheus/wildcard.yml` de ce dépôt) :

```yaml
global:
  scrape_interval: 15s
  scrape_timeout: 10s

scrape_configs:
  # ── collé depuis deploy/prometheus/wildcard.yml ──
  - job_name: wildcard-app
    metrics_path: /api/metrics
    authorization:
      type: Bearer
      credentials_file: /etc/prometheus/wildcard-token
    static_configs:
      - targets: [wildcard-app:3000]
        labels: { project: wildcard }

  - job_name: crowdsec
    static_configs:
      - targets: [crowdsec:6060]

  - job_name: prometheus
    static_configs:
      - targets: [localhost:9090]
```

**`grafana/provisioning/datasources/datasources.yml`** — ⚠️ les `uid` doivent
rester `prometheus` et `umami-postgres` : les dashboards JSON les référencent.

```yaml
apiVersion: 1
datasources:
  - name: Prometheus
    uid: prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    jsonData: { httpMethod: POST, timeInterval: 15s }
  - name: Umami (PostgreSQL)
    uid: umami-postgres
    type: postgres
    access: proxy
    url: umami-db:5432
    user: umami
    jsonData: { database: umami, sslmode: disable, postgresVersion: 1500 }
    secureJsonData: { password: ${UMAMI_DB_PASSWORD} }
```

**`grafana/provisioning/dashboards/dashboards.yml`** :

```yaml
apiVersion: 1
providers:
  - name: Wildcard
    type: file
    folder: Wildcard
    options:
      path: /var/lib/grafana/dashboards
```

### `.env` du central

```bash
ACME_EMAIL=admin@example.com
CROWDSEC_API_KEY=            # openssl rand -hex 32  (bouncer Caddy↔agent)
WILDCARD_APP_DOMAIN=wildcard.example.com
WILDCARD_API_DOMAIN=api.wildcard.example.com
METRICS_TOKEN=              # openssl rand -hex 32  — IDENTIQUE à celui de Wildcard
UMAMI_DB_PASSWORD=          # openssl rand -hex 16
UMAMI_APP_SECRET=           # openssl rand -base64 32
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=     # openssl rand -base64 24
```

Démarrer :

```bash
docker network create edge          # si pas déjà fait
docker compose up -d --build        # 1er build : compile Caddy (~1 min)
```

---

## 2 — Wiring de Wildcard

Le `docker-compose.yml` de Wildcard attache déjà `app` et `kong` au réseau
externe `edge` avec les alias `wildcard-app` / `wildcard-kong`. Il suffit donc,
dans `.env.docker` de Wildcard :

```bash
# Doit matcher le METRICS_TOKEN du central (scrape de /api/metrics)
METRICS_TOKEN=<même-valeur-que-le-central>

# Tag Umami — pointer vers l'Umami central, joignable depuis le NAVIGATEUR
UMAMI_URL=https://umami.example.com      # ou http://<serveur>:54325 via tunnel
UMAMI_WEBSITE_ID=<id du site créé dans l'UI Umami>

# URLs publiques = domaines servis par le Caddy central
SITE_URL=https://wildcard.example.com
API_EXTERNAL_URL=https://api.wildcard.example.com
SUPABASE_PUBLIC_URL=https://api.wildcard.example.com
ADDITIONAL_REDIRECT_URLS=https://wildcard.example.com/auth/callback
```

Puis démarrer Wildcard **sans exposer les ports** publics (le central les fronte)
via l'override loopback :

```bash
docker network create edge          # si pas déjà fait
docker compose --env-file .env.docker \
  -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Créer le site Umami : ouvrir l'UI Umami → nouveau site « Wildcard » → copier le
**Website ID** dans `UMAMI_WEBSITE_ID`, redémarrer l'app. Sans lui, le tag ne se
charge pas (aucun impact en local).

### Ordre de démarrage

1. `docker network create edge`
2. Wildcard (`app`/`kong` rejoignent `edge`)
3. Stack centrale (Caddy résout `wildcard-app`/`wildcard-kong`, émet les certs)

L'ordre entre 2 et 3 importe peu : Caddy retente la résolution DNS ; un projet
absent du réseau remonte simplement `502` jusqu'à ce qu'il soit up.

---

## Durcissement réseau

Seuls **80/443** (Caddy central) et **22** (SSH) sont ouverts sur l'extérieur.
Les ports internes de Wildcard (app `3000`, Kong `54321/54322`) sont rebindés en
`127.0.0.1` par `docker-compose.prod.yml` — le chemin public passe par `edge`,
pas par l'hôte. Les UI d'admin (Grafana `54327`, Umami `54325`, Studio `54323`)
restent en loopback : y accéder par **tunnel SSH**
(`ssh -L 54327:localhost:54327 serveur`).

> ⚠️ **Docker + ufw** : Docker insère ses règles iptables **avant** ufw. Un
> `ufw deny 3000` ne bloque pas un port publié par Docker → toujours rebinder en
> `127.0.0.1` plutôt que compter sur le pare-feu seul.

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### Vérifs CrowdSec

```bash
docker exec <crowdsec> cscli metrics        # parsing + scénarios
docker exec <crowdsec> cscli decisions list # bans actifs
docker exec <crowdsec> cscli bouncers list  # le bouncer `caddy` = valid
```
