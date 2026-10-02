import type { CardDescriptor } from "@/lib/card/types";
import type { GameState } from "@/lib/engine/types";
import type {
    ECA_CARD_PROPS,
    ECA_CARD_SOURCES,
    ECA_COMPARATORS,
    ECA_DECK_IDS,
    ECA_DRAW_TARGETS,
    ECA_EVENT_TYPES,
    ECA_STAT_SOURCES,
} from "./schema";

/**
 * ECA definition: the plain JSON a Studio game is made of — data, never code,
 * validated on every write and re-narrowed on every read.
 */

export const ECA_DEFINITION_VERSION = 1;

export type EcaDeckId = (typeof ECA_DECK_IDS)[number];
export type EcaEventType = (typeof ECA_EVENT_TYPES)[number];
export type EcaCardSource = (typeof ECA_CARD_SOURCES)[number];
/** `value` is the rank's index in the deck (low → high), so it is deck-relative. */
export type EcaCardProp = (typeof ECA_CARD_PROPS)[number];
/** `actorHandCount` is read before the effects: it still includes the card being played. */
export type EcaStatSource = (typeof ECA_STAT_SOURCES)[number];
export type EcaComparator = (typeof ECA_COMPARATORS)[number];
export type EcaDrawTarget = (typeof ECA_DRAW_TARGETS)[number];

export type EcaOperand =
    | {
          readonly kind: "card";
          readonly source: EcaCardSource;
          readonly prop: EcaCardProp;
      }
    | { readonly kind: "stat"; readonly source: EcaStatSource }
    | { readonly kind: "literal"; readonly value: string | number };

export interface EcaCondition {
    readonly lhs: EcaOperand;
    readonly op: EcaComparator;
    readonly rhs: EcaOperand;
}

export type EcaEffect =
    | { readonly type: "acceptCard" }
    | { readonly type: "rejectCard" }
    | {
          readonly type: "drawCards";
          readonly target: EcaDrawTarget;
          readonly count: number;
      }
    | { readonly type: "skipNextPlayer" }
    | { readonly type: "reverseDirection" }
    | { readonly type: "playAgain" }
    | { readonly type: "endGame"; readonly winner: "actor" };

export interface EcaRule {
    readonly id: string;
    readonly name: string;
    readonly event: EcaEventType;
    /** AND-combined; empty always matches. */
    readonly conditions: readonly EcaCondition[];
    readonly effects: readonly EcaEffect[];
}

export interface EcaDefinition {
    readonly version: 1;
    readonly meta: {
        readonly name: string;
        readonly description?: string;
        readonly minPlayers: number;
        readonly maxPlayers: number;
    };
    readonly setup: {
        readonly deckId: EcaDeckId;
        readonly handSize: number;
        readonly startDiscard: boolean;
    };
    readonly turn: {
        readonly allowDraw: boolean;
        readonly allowPass: boolean;
        readonly passRequiresDraw: boolean;
        readonly reshuffleDiscard: boolean;
    };
    /** First matching rule wins: order is load-bearing. */
    readonly rules: readonly EcaRule[];
    readonly win: { readonly condition: "emptyHand" };
}

export interface EcaState extends GameState {
    /** Stamped at setup so any module instance can resume or replay the game. */
    readonly definition: EcaDefinition;
    readonly hands: Readonly<Record<string, readonly CardDescriptor[]>>;
    readonly drawPile: readonly CardDescriptor[];
    /** Top = last element. */
    readonly discardPile: readonly CardDescriptor[];
    readonly direction: 1 | -1;
    readonly pendingSkips: number;
    readonly hasDrawnThisTurn: boolean;
    readonly consecutivePasses: number;
    readonly winnerIds: readonly string[];
}

export type EcaAction =
    | {
          readonly type: "playCard";
          readonly playerId: string;
          readonly card: CardDescriptor;
      }
    | { readonly type: "drawCard"; readonly playerId: string }
    | { readonly type: "pass"; readonly playerId: string };

export interface EcaPlayerView {
    readonly id: string;
    readonly name: string;
    readonly seat: number;
    readonly handCount: number;
    /** Only in the viewer's own slot. */
    readonly hand?: readonly CardDescriptor[];
}

export interface EcaView {
    readonly gameId: string;
    readonly phase: string;
    readonly turn: number;
    readonly currentPlayerId: string | null;
    readonly direction: 1 | -1;
    readonly topDiscard: CardDescriptor | null;
    readonly discardCount: number;
    readonly drawPileCount: number;
    readonly hasDrawnThisTurn: boolean;
    readonly winnerIds: readonly string[];
    readonly definition: {
        readonly name: string;
        readonly rules: ReadonlyArray<{
            readonly id: string;
            readonly name: string;
            readonly event: EcaEventType;
        }>;
    };
    readonly players: readonly EcaPlayerView[];
    readonly self: string | null;
}
