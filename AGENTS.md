<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
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
- **Supabase** — PostgreSQL managé
- **Supabase Auth**
- **RLS (Row Level Security)** — chaque joueur ne voit que sa propre main
- **`@supabase/supabase-js`** — seul client DB utilisé (pas Prisma)

### Temps réel
- **Supabase Realtime** — synchronisation de l'état de jeu entre les clients

---

## Architecture applicative

### Moteur de jeu — Plugin Pattern
Chaque jeu est un module indépendant qui implémente une interface commune :
```ts
interface GameModule {
  initialState(players: Player[]): GameState;
  playCard(state: GameState, action: PlayerAction): GameState;
  nextTurn(state: GameState): GameState;
  isGameOver(state: GameState): boolean;
}
```
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

---

## Internationalisation (i18n)

Locales supportées : **`fr`** (défaut), `en`.

### Conventions
- **`src/proxy.ts`** — détection de locale via `Accept-Language` + redirect. Convention Next.js 16 : `proxy.ts` (pas `middleware.ts`, déprécié).
- **`src/app/[lang]/`** — segment dynamique racine. Toutes les pages vivent sous ce segment.
- **`src/dictionaries/`** — fichiers JSON par locale (`fr.json`, `en.json`). `fr.json` est la source de vérité pour les types.
- **`src/lib/i18n.ts`** — exports : `Locale`, `Dictionary`, `locales`, `defaultLocale`, `getDictionary`.

### Ajouter une page traduite

```ts
// src/app/[lang]/ma-page/page.tsx
import { getDictionary } from "@/lib/i18n";

export default async function MaPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const dict = await getDictionary(lang);
  // ...
}
```

Ajouter la clé dans `fr.json` ET `en.json` — TypeScript l'exige (`Dictionary` est dérivé de `fr.json`).

### Ajouter une locale

1. Créer `src/dictionaries/<locale>.json` (même structure que `fr.json`)
2. Ajouter la locale dans `src/lib/i18n.ts` (`locales` array + `dictionaries` map)
3. Ajouter la locale dans `src/proxy.ts` (`locales` array)

---

## Structure du projet (cible)

```
wildcard/
├── app/
│   ├── [lang]/              # Segment i18n racine
│   │   ├── (auth)/          # Login, register
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
├── lib/
│   ├── i18n.ts              # Locale, Dictionary, getDictionary
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
├── proxy.ts                 # Détection locale + redirect (Next.js 16)
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
