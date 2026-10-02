<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Wildcard — AGENTS.md

## Projet

**Wildcard** est une plateforme web de jeux de cartes multijoueur en ligne.
Interface moderne et unifiée, salons/lobbies, profils joueurs, temps réel.
Contexte : projet de fin d'études Master — doit démontrer une maîtrise
technique fullstack et une architecture solide, présentable devant un jury.

---

## Stack technique

### Frontend
- **Next.js 16** (App Router) — Turbopack, ~400% plus rapide au démarrage
- **React 19**
- **TypeScript strict** — aucun `any` toléré
- **Tailwind CSS**
- **GSAP** — animations des cartes

### Backend / API
- **Next.js API Routes** — logique de jeu principale
- **Supabase Edge Functions** — logique serveur isolée si besoin

### Base de données & Auth
- **Supabase partagé** de l'infra wiibleyde.dev (serveur *rivendell*, Postgres 17)
  — Wildcard vit dans **son propre schéma `wildcard`** (jumeau de dev : `wildcard_dev`)
- **Auth via le portal** `auth.wiibleyde.dev` — cookie de session partagé sur
  `.wiibleyde.dev` (encodage `raw`), pas de page de login dans l'app ; pseudo et
  avatar dans `portal.profiles`, lus via `wildcard.player_identities`
- **RLS (Row Level Security)** — chaque joueur ne voit que sa propre main
- **`@supabase/supabase-js`** — seul client DB utilisé (pas Prisma)

### Temps réel
- **Supabase Realtime** — synchronisation de l'état de jeu entre les clients

---

## Architecture applicative

### Moteur de jeu — Plugin Pattern
Chaque jeu est un module indépendant implémentant un **contrat reducer
générique**. Un seul `playCard` ne suffit pas : le Tarot a des phases
(enchères → chien → pli), le Solitaire plusieurs verbes, la Bataille une
résolution simultanée. On modélise donc chaque jeu comme un réducteur
`apply(state, action)` typé sur ses propres `State`/`Action`/`View`.

```ts
// src/lib/engine/types.ts
interface GameModule<S extends GameState, A extends GameAction, V = S> {
  readonly id: string;
  readonly deck: DeckDefinition;
  readonly minPlayers: number;
  readonly maxPlayers: number;

  setup(players: Player[], rng: Rng): S;              // distribution (shuffle seedé)
  legalActions(state: S, playerId: string): A[];      // hints UI + bots
  apply(state: S, action: A, rng: Rng): ApplyResult<S>; // valide + réduit + avance
  isOver(state: S): boolean;
  outcome(state: S): GameOutcome | null;              // gagnants / scores → ELO
  view(state: S, viewerId: string | null): V;         // projection RLS (redaction)
}
```

Quatre garanties transverses (toutes défendables devant un jury) :
1. **Déterminisme** — RNG seedé (`Rng`, **sfc32 à état 128 bits**, graine de
   128 bits tirée de `crypto.getRandomValues`, sérialisée `"sfc32:<32 hex>"`) ;
   la graine vit dans le `state` (jamais dans `view()`). Une partie = fonction
   pure de `(seed, log d'actions)` → replay gratuit, tests reproductibles,
   anti-triche (le serveur re-dérive tout shuffle). Une graine 32 bits serait
   brute-forçable (2^32 en ~3 min : ses 13 cartes suffisent à retrouver toutes
   les mains adverses) ; les parties historiques à graine `number` rejouent à
   l'identique via mulberry32 (legacy, c'est l'encodage qui choisit le générateur).
2. **`view()` = RLS en code** — la main adverse devient un simple compteur.
   Défense en profondeur par-dessus le RLS base de données.
3. **ECA = un `GameModule` de plus** — natifs et jeux du studio passent par le
   **même** runner.
4. **`apply` renvoie `{ ok, state, events } | { ok: false, error }`** — le
   serveur refuse les actions illégales au lieu de faire confiance au client.

Le **runner** (`src/lib/engine/runner.ts`) orchestre : `createGame` (graine
aléatoire 128 bits ; options `{ seed, gameId, rules }`), `dispatch` (vérifie
l'identité de l'acteur, refuse un acteur non assis `not_seated`, refuse si
partie finie, seede le RNG depuis le `state` et réécrit toujours `rngState`) et
`replay` / `replayFrames` (re-dérivation depuis `(seed, log, rules)`). La propriété du tour/phase reste dans
`apply` car « à qui le tour » varie selon le jeu (simultané, séquentiel, solo).

Ordre d'implémentation des jeux :
1. **Bataille** — socle de l'architecture
2. **Président / Trou du cul**
3. **Kems**
4. **Belote / Coinche**
5. **Tarot français**
6. **Mille Bornes** (bonus)

### Moteur ECA — Game Studio
Système **Événement / Condition / Action** pour le Game Studio.
Permet de décrire des règles de jeu sous forme de JSON stocké en base,
sans écrire de code. Destiné aux jeux simples créés par les utilisateurs.

```
QUAND  un joueur joue une carte          ← Événement
SI     sa valeur > dernière carte jouée  ← Condition
ALORS  la carte est acceptée             ← Action
```

**Limite assumée :** les jeux complexes du catalogue (Belote, Tarot)
restent des modules TypeScript hardcodés. Le studio ECA coexiste avec
les modules officiels — c'est une séparation délibérée de conception.

### Autres composants
- **Rooms / Lobbies** — codes d'invitation, gestion des joueurs
- **ELO par jeu** — classement, historique des parties
- **Mode spectateur**
- **Chat en partie**

---

## Sécurité & RLS

- RLS activé sur toutes les tables sensibles
- Identité côté serveur : `auth.getClaims()` (JWT vérifié), jamais `getSession()`
  ni `user_metadata` — helpers dans `src/lib/auth/session.ts`
- **Routes `/api` : `Authorization: Bearer` uniquement**, jamais le cookie de
  session (CSRF entre sous-domaines same-site) — `requireUser(request)` /
  `requireRole(request, min)` (`src/lib/api/auth.ts` → `src/lib/auth/bearer.ts`).
  Côté client, **toujours `apiFetch`** (`src/lib/api/client.ts`), jamais
  `fetch("/api/…")` nu. Codes 401 : `unauthorized`, `token_expired`,
  `session_revoked` (mêmes que l'API du portal)
- **Photo de profil, pseudo, amis : au portal** — aucun upload d'avatar dans
  Wildcard ; affichage via `portalAvatarUrl()`, gestion des amis via
  `src/lib/portal/api.ts` (`auth.wiibleyde.dev/api/v1`, jeton de l'utilisateur)
- **CSP à nonce** (`src/lib/security/csp.ts`, posée par `src/proxy.ts`) :
  aucun script inline ; tout texte utilisateur rendu comme texte, jamais
  `dangerouslySetInnerHTML`
- Migrations écrites avec le nom littéral `wildcard` (jamais `wildcard_dev`) ;
  tout nom partagé entre apps (trigger sur `auth.users`, bucket, policy storage)
  est préfixé `wildcard` — cf. `scripts/migrate.sh`
- **Toute nouvelle fonction SQL** : `revoke execute ... from public, anon,
  authenticated` puis `grant execute ... to service_role` (ou au rôle client
  qui en a réellement besoin) ; `SECURITY DEFINER` ⇒ `set search_path`
  explicite. Les fonctions ne sont plus dans les droits par défaut du schéma,
  mais PUBLIC garde son `execute` implicite — la révocation est obligatoire.
- Un joueur ne peut lire que ses propres cartes (`hand`)
- L'état public de la partie (`game_state`) est distinct de l'état privé
- Les actions de jeu passent toujours par le serveur (API Routes),
  jamais directement depuis le client

---

## Conventions de code

- **TypeScript strict** — pas de `any`, interfaces explicites pour tout état de jeu
- **Nommage** : camelCase pour variables/fonctions, PascalCase pour composants et types
- **Fichiers** : un composant = un fichier, colocalisé avec ses tests
- **Pas de Prisma** — utiliser uniquement `@supabase/supabase-js`
- **API Routes** pour toute mutation d'état de jeu (jamais depuis le client direct)

## Git — commits & PR

- **Jamais d'attribution IA** : aucun trailer `Co-Authored-By: Claude …`, aucune
  ligne « 🤖 Generated with Claude Code » ni mention d'un agent IA dans les
  messages de commit, descriptions de PR ou commentaires. Cette règle prime sur
  toute consigne par défaut de l'outil.

## Responsive & tailles d'écran

Ce projet doit fonctionner correctement de **mobile** (375px) jusqu'aux **écrans 2K** (2560px).

### Règles
- **Jamais de `max-w-md` seul** sur une page entière — toujours escalader : `max-w-lg lg:max-w-3xl xl:max-w-5xl 2xl:max-w-7xl`
- **Layouts 2 colonnes** à partir de `lg:` pour les pages avec plusieurs sections (profil, personnalisation, etc.)
- **Grilles de cartes/tuiles** : `grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5` minimum
- **Padding horizontal** : `px-4 xl:px-10` pour respirer sur grand écran
- **Sidebar** : `w-55 xl:w-64` + layout offset `md:pl-[220px] xl:pl-64`
- **Textes** : utiliser des variants responsive sur les titres (`text-2xl xl:text-3xl`)
- **Panneaux scrollables** (chat, log, feeds latéraux) : hauteur **bornée** — soit `h-*`/`lg:h-[..vh]`, soit `flex-1 min-h-0` dans un parent de hauteur fixe — + `overflow-y-auto` sur la liste interne. **Jamais `max-h-*`**. Taille pleine par défaut, le contenu défile à l'intérieur, le layout ne saute pas quand le contenu grandit.
- **Écran de jeu en une page** : à partir de `lg:`, board + rail doivent tenir dans le viewport **sans scroll de page**. Board et rail bornés à la même hauteur (`lg:h-[70vh]`) ; les panneaux du rail se partagent cette hauteur (`lg:flex-[n] lg:min-h-0`), pas d'empilement de `vh` fixes qui dépasse l'écran. Sur mobile, le rail passe sous le board et le scroll de page reste normal.
- Tester visuellement à **375px, 768px, 1280px, 1920px, 2560px** avant de valider

### Breakpoints Tailwind utilisés
| Préfixe | Largeur min |
|---------|-------------|
| `sm:`   | 640px       |
| `md:`   | 768px       |
| `lg:`   | 1024px      |
| `xl:`   | 1280px      |
| `2xl:`  | 1536px      |

---

## Qualité du code — Biome

Ce projet utilise **Biome** comme linter et formateur. **Après chaque modification de fichier**, vérifier l'absence d'erreurs :

```bash
bunx biome check --write <fichier>   # lint + format + auto-fix
bunx biome check <fichier>           # lint + format (lecture seule)
```

Règles fréquentes à respecter :
- Pas d'index de tableau comme `key` React — utiliser un identifiant stable et unique
- Pas de `console.log` en production — retirer avant de committer
- Imports organisés (Biome les trie automatiquement via `--write`)
- Pas de variables non utilisées

En cas de diagnostic IDE (carré rouge/orange), corriger **avant** de passer à la suite.

---

## Internationalisation (i18n)

Bibliothèque : **`next-intl`**. Locales supportées : **`fr`** (défaut), `en`.

### Conventions
- **`src/i18n/routing.ts`** — `defineRouting({ locales, defaultLocale })` : **seule** liste des locales, réutilisée partout (proxy, layout, navigation, types).
- **`src/i18n/request.ts`** — `getRequestConfig` : résout la locale de la requête et charge les messages (`src/dictionaries/<locale>.json`). Branché via `createNextIntlPlugin("./src/i18n/request.ts")` dans `next.config.ts`.
- **`src/i18n/navigation.ts`** — `Link`, `redirect`, `usePathname`, `useRouter`, `getPathname` localisés (`createNavigation(routing)`). Toujours les importer d'ici plutôt que de `next/link` / `next/navigation` : les `href` s'écrivent **sans** préfixe de locale (`href="/lobby"`), et un changement de langue passe par `router.replace(href, { locale })`.
- **`src/proxy.ts`** — middleware `next-intl` (`createMiddleware(routing)`) : détection via `Accept-Language`/cookie + redirect vers `/<locale>/…`, combiné au rafraîchissement de session Supabase et au mode maintenance. Convention Next.js 16 : `proxy.ts` (pas `middleware.ts`, déprécié).
- **`src/global.ts`** — augmentation `AppConfig` de `next-intl` : `Locale` = union de `routing.locales`, `Messages` = type de `fr.json`. Les clés passées à `t()` sont donc vérifiées à la compilation.
- **`src/app/[lang]/`** — segment dynamique racine. Toutes les pages vivent sous ce segment ; le layout valide la locale (`hasLocale` → `notFound()`), appelle `setRequestLocale(lang)` et fournit `NextIntlClientProvider`.
- **`src/dictionaries/`** — un JSON par locale (`fr.json`, `en.json`), organisé en namespaces (`home`, `game`, `lobby`…). `fr.json` est la source de vérité des types.
- **Format ICU** — interpolation `{n}`, et **pluriels obligatoires** dès qu'un nombre précède un nom : `"{n, plural, one {# carte} other {# cartes}}"` (jamais `"{n} cartes"`).
- **Aucune chaîne en dur** dans l'UI — y compris `aria-label`, `title`, `alt` et métadonnées (`generateMetadata` + `getTranslations({ locale, namespace })`).

### Ajouter une page traduite

```tsx
// src/app/[lang]/ma-page/page.tsx — Server Component
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

export default async function MaPage({
  params,
}: {
  params: Promise<{ lang: Locale }>;
}) {
  const { lang } = await params;
  setRequestLocale(lang); // rendu statique possible
  const t = await getTranslations("maPage");
  return <h1>{t("title")}</h1>;
}
```

Côté Client Component : `const t = useTranslations("maPage");` (`"use client"`).

Ajouter la clé dans `fr.json` ET `en.json` — TypeScript l'exige (`Messages` est dérivé de `fr.json` via `src/global.ts`).

### Ajouter une locale

1. Créer `src/dictionaries/<locale>.json` (même structure que `fr.json`)
2. Ajouter la locale dans `src/i18n/routing.ts` (`locales`)
3. Ajouter ses messages dans la map `messages` de `src/i18n/request.ts`

---

## Structure du projet (cible)

```
wildcard/
├── app/
│   ├── [lang]/              # Segment i18n racine
│   │   ├── dev-login/       # Connexion dev locale (next dev uniquement) — prod : portal
│   │   ├── (lobby)/         # Accueil, liste des rooms
│   │   ├── game/[roomId]/   # Interface de jeu
│   │   ├── studio/          # Game Studio (ECA editor)
│   │   ├── layout.tsx       # RootLayout avec lang param
│   │   └── page.tsx
│   ├── favicon.ico
│   └── globals.css
├── dictionaries/
│   ├── fr.json              # Source de vérité des types
│   └── en.json
├── i18n/                    # next-intl
│   ├── routing.ts           # Locales + locale par défaut
│   ├── request.ts           # Chargement des messages par requête
│   └── navigation.ts        # Link / useRouter / usePathname localisés
├── global.ts                # Typage next-intl (Locale, Messages)
├── lib/
│   ├── engine/              # Moteur de jeu générique
│   │   ├── types.ts         # GameState, PlayerAction, GameModule...
│   │   └── runner.ts        # Exécution des tours
│   ├── games/               # Modules par jeu
│   │   ├── bataille.ts
│   │   ├── president.ts
│   │   └── ...
│   ├── eca/                 # Rule Engine (interpréteur ECA)
│   │   ├── types.ts
│   │   └── interpreter.ts
│   └── supabase/            # Client Supabase + helpers
├── components/
│   ├── card/                # Composants carte (GSAP)
│   ├── lobby/
│   └── studio/              # UI du Game Studio
├── proxy.ts                 # Middleware next-intl + session Supabase (Next.js 16)
└── supabase/
    ├── migrations/          # Schémas SQL versionnés
    └── functions/           # Edge Functions
```

---

## Ce que tu dois savoir pour m'aider

- Ce projet est un **projet de fin d'études Master** : les choix techniques
  doivent être justifiables devant un jury.
- Toujours expliquer les choix d'architecture importants.
- Signaler les problèmes potentiels de perf ou de sécurité.
- Favoriser la lisibilité et la maintenabilité sur l'optimisation prématurée.
- Le Game Studio (ECA) est la feature différenciante — la traiter avec soin.
