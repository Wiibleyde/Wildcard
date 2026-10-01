# Déploiement — rivendell (infra mutualisée wiibleyde.dev)

Wildcard s'installe sur **rivendell** comme les autres apps de l'infra
(`~/infra/`, cf. son `CLAUDE.md`). Rien d'infrastructurel n'est lancé depuis ce
dépôt : Caddy, CrowdSec, Supabase, le portal, Prometheus, Grafana et Umami
existent déjà et sont **réutilisés**. Wildcard apporte :

| Fichier (ce dépôt) | Destination sur le serveur |
| --- | --- |
| `deploy/compose.yml` + `deploy/.env.example` | `~/infra/services/wildcard/compose.yml` + `.env` |
| `deploy/caddy/wildcard.caddy` | bloc collé dans `~/infra/edge/caddy/conf/Caddyfile` |
| `deploy/prometheus/wildcard.yml` | job ajouté à `~/infra/monitoring/prometheus/prometheus.yml` |
| `deploy/grafana/datasources/umami.yml` | `~/infra/monitoring/grafana/provisioning/datasources/` |
| `deploy/grafana/dashboards/wildcard-*.json` | dashboards importés dans Grafana |

```
Internet ─443─▶ Caddy + CrowdSec ── front ──▶ wildcard:3000
navigateur ───▶ supabase.wiibleyde.dev (Kong)        ◀── auth.wiibleyde.dev (portal, cookie .wiibleyde.dev)
wildcard ── supabase ──▶ supabase-kong:8000 (appels serveur) · db:5432 (migrations, supabase_admin)
Prometheus ── monitoring ──▶ wildcard:3000/api/metrics
```

Le conteneur `wildcard` ne publie **aucun port** : tout passe par les réseaux
Docker `front`, `supabase` et `monitoring`.

---

## Checklist (une fois)

### 1. Supabase — exposer les schémas

Les schémas `wildcard` (prod) et `wildcard_dev` (dev partagé) sont créés par les
migrations elles-mêmes. Il faut seulement les exposer à PostgREST :

```bash
cd ~/infra/services/supabase
# .env : ajouter wildcard,wildcard_dev à PGRST_DB_SCHEMAS
#   PGRST_DB_SCHEMAS=public,graphql_public,incognito,portal,kestion,kestion_dev,wildcard,wildcard_dev
docker compose up -d rest        # up -d, PAS restart (restart ne relit pas l'env)
```

Sans ça, toute requête de l'app échoue en `PGRST106` (schema not exposed).

### 2. Stack Wildcard

```bash
mkdir -p ~/infra/services/wildcard && cd ~/infra/services/wildcard
# copier deploy/compose.yml → compose.yml et deploy/.env.example → .env, puis remplir .env :
#   SUPABASE_PUBLISHABLE_KEY / SUPABASE_SECRET_KEY : mêmes valeurs que ~/infra/services/supabase/.env
#   WILDCARD_DATABASE_URL : postgresql://supabase_admin:<mdp>@db:5432/postgres
#   METRICS_TOKEN : openssl rand -hex 32
docker compose pull
docker compose up -d
docker compose logs -f wildcard  # « migrate: 26 applied … (schema wildcard) » puis Ready
```

Au premier démarrage, l'entrypoint crée le schéma `wildcard`, ses tables, le
trigger `on_auth_user_wildcard`, le bucket `wildcard-eca-images`, et crée un
profil de jeu pour **chaque compte existant** du portal (backfill).

`WILDCARD_DATABASE_URL` donne `supabase_admin` au conteneur : c'est le seul rôle
autorisé à poser un trigger sur `auth.users` partagé (même modèle que Kestion).
Une fois les migrations stables, `WILDCARD_MIGRATE=skip` permet de démarrer sans.

### 3. Caddy

Coller `deploy/caddy/wildcard.caddy` dans le Caddyfile (le snippet `(common)`
apporte déjà CrowdSec, compression et en-têtes de sécurité), puis :

```bash
docker exec caddy caddy validate --config /etc/caddy/Caddyfile
docker exec caddy caddy reload   --config /etc/caddy/Caddyfile
```

DNS : `wildcard.wiibleyde.dev` doit pointer vers rivendell (A/AAAA, sauf
enregistrement générique). Le certificat est émis au premier accès.

### 4. Portal

Rien à faire pour la redirection : le portal accepte tout `next` en
`https://*.wiibleyde.dev`, et GoTrue autorise déjà `https://*.wiibleyde.dev/**`.
Optionnel : ajouter Wildcard au catalogue du portal (`services/portal/app/services.json`,
entrée **sans** `host` — Wildcard fait sa propre vérification de session), puis
`docker compose restart portal`.

### 5. Observabilité

**Prometheus** (`~/infra/monitoring/`) :

1. `printf '%s' '<METRICS_TOKEN>' > prometheus/wildcard-token` (même valeur que le `.env`).
2. Monter `./prometheus/wildcard-token:/etc/prometheus/wildcard-token:ro` dans le service Prometheus.
3. Ajouter le job de `deploy/prometheus/wildcard.yml` aux `scrape_configs`.
4. `docker compose up -d prometheus` → cible `wildcard-app` UP dans *Status → Targets*.

**Grafana** :

1. Attacher Grafana au réseau `umami` et lui passer `UMAMI_DB_PASSWORD`.
2. Déposer `deploy/grafana/datasources/umami.yml` (uid `umami-postgres`, Postgres 17).
3. Importer `wildcard-games.json` et `wildcard-web.json` (la datasource `prometheus`
   existe déjà). `crowdsec.json` : seulement s'il n'y a pas déjà un dashboard CrowdSec.

**Umami** : UI → nouveau site « Wildcard » (`wildcard.wiibleyde.dev`) → copier le
Website ID dans `UMAMI_WEBSITE_ID` du `.env`, puis `docker compose up -d`.

### 6. Premier admin

```sql
update wildcard.user_roles set role = 'admin'
where user_id = (select id from auth.users where email = '<email>');
```

---

## Dev partagé — schéma `wildcard_dev`

Pour développer en local contre le vrai Supabase (`bun run dev:shared`), le
schéma `wildcard_dev` se crée et se met à jour **sur le serveur**, depuis un
clone du dépôt :

```bash
WILDCARD_DATABASE_URL='postgresql://supabase_admin:<mdp>@db:5432/postgres' \
  bun run db:apply:shared          # wildcard_dev par défaut
```

Le runner réécrit `wildcard` → `wildcard_dev` dans chaque migration : tables,
trigger `on_auth_user_wildcard_dev`, bucket `wildcard_dev-eca-images` et
policies sont propres au schéma de dev, sans collision avec la prod.

---

## Exploitation

```bash
cd ~/infra/services/wildcard
docker compose pull && docker compose up -d          # déployer latest
WILDCARD_TAG=sha-<commit> docker compose up -d       # rollback
docker exec supabase-db psql -U supabase_admin -d postgres \
  -c "select * from wildcard.schema_migrations order by version desc limit 5;"
```

### Ordre de déploiement — migrations et code ensemble

Migrations et code se déploient **ensemble** : l'entrypoint du conteneur applique
les migrations puis démarre la nouvelle version, et l'ancien conteneur est
arrêté par `docker compose up -d` — on ne fait pas tourner deux versions en
parallèle sur la même base. Ne pas appliquer les migrations à la main longtemps
avant de basculer le code (ni l'inverse, `WILDCARD_MIGRATE=skip` avec un code
plus récent que le schéma).

Garde-fou si une ancienne instance termine quand même une partie après la
migration (déploiement progressif) : le règlement ELO/XP rejoué au démarrage
(`settlePendingGames`) ne reprend que les parties portant un `end_reason`
(`20261001140000_game_end_reason.sql`), colonne écrite uniquement par le code
actuel. Une partie terminée par l'ancien code — déjà réglée par l'ancien chemin,
`settled_at` resté NULL — n'est donc jamais réglée une seconde fois (pas de
double ELO).

Sécurité réseau : seuls 22/80/443 sont exposés sur rivendell ; il n'y a pas de
pare-feu hôte, donc la règle est de **ne jamais publier** de port dans un
compose (Docker passe devant tout pare-feu de toute façon).
