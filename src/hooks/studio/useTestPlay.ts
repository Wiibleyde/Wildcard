"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import type { CardDescriptor, Suit } from "@/lib/card/types";
import { cardKey } from "@/lib/card/utils";
import { createEcaModule } from "@/lib/eca/module";
import type {
    EcaAction,
    EcaDefinition,
    EcaState,
    EcaView,
} from "@/lib/eca/types";
import { validateEcaDefinition } from "@/lib/eca/validate";
import { clientState, createGame, dispatch } from "@/lib/engine/runner";
import type { GameEvent, GameModule, Player } from "@/lib/engine/types";

/**
 * State + logic for the Studio sandbox ({@link import("@/components/studio/TestPlay").TestPlay}):
 * the current draft becomes a real {@link GameModule} (`eca:draft`) driven
 * through the REAL runner — `createGame`, `dispatch`, `clientState` — exactly
 * like a native game. Each seat's hand comes from that seat's own redacted
 * view, so the projection layer is exercised too. No simulation shortcuts: if
 * it works here, it works in a match.
 */

const SUIT_GLYPH: Record<Suit, string> = {
    spades: "♠",
    hearts: "♥",
    diamonds: "♦",
    clubs: "♣",
};

export function cardLabel(card: CardDescriptor): string {
    return card.type === "suited"
        ? `${card.rank}${SUIT_GLYPH[card.suit]}`
        : "?";
}

export function isRedSuit(card: CardDescriptor): boolean {
    return (
        card.type === "suited" &&
        (card.suit === "hearts" || card.suit === "diamonds")
    );
}

function asCard(value: unknown): CardDescriptor | null {
    if (typeof value !== "object" || value === null) return null;
    const record = value as Record<string, unknown>;
    return record.type === "suited" ? (value as CardDescriptor) : null;
}

export interface LogEntry {
    readonly id: number;
    readonly text: string;
}

interface Sandbox {
    readonly module: GameModule<EcaState, EcaAction, EcaView>;
    readonly players: readonly Player[];
    readonly state: EcaState;
    readonly log: readonly LogEntry[];
    readonly nextId: number;
    /** Snapshot of the definition the game was dealt with — staleness check. */
    readonly definitionJson: string;
}

/** One seat's derived play state, projected from that seat's own view. */
export interface TestSeatState {
    readonly player: Player;
    readonly hand: readonly CardDescriptor[];
    readonly playable: ReadonlySet<string>;
    readonly canDraw: boolean;
    readonly canPass: boolean;
    readonly isCurrent: boolean;
}

type RefusalCode =
    | "illegal_card"
    | "not_your_turn"
    | "cannot_draw"
    | "cannot_pass";

type RefusalKey =
    | "refuse_illegal_card"
    | "refuse_not_your_turn"
    | "refuse_cannot_draw"
    | "refuse_cannot_pass";

const REFUSAL_KEYS: Record<RefusalCode, RefusalKey> = {
    illegal_card: "refuse_illegal_card",
    not_your_turn: "refuse_not_your_turn",
    cannot_draw: "refuse_cannot_draw",
    cannot_pass: "refuse_cannot_pass",
};

function isRefusalCode(code: string): code is RefusalCode {
    return code in REFUSAL_KEYS;
}

export function useTestPlay(definition: EcaDefinition) {
    const t = useTranslations("studio");
    const [sandbox, setSandbox] = useState<Sandbox | null>(null);
    const [refusal, setRefusal] = useState<RefusalCode | "generic" | null>(
        null,
    );

    const currentJson = useMemo(() => JSON.stringify(definition), [definition]);
    const stale = sandbox !== null && sandbox.definitionJson !== currentJson;

    function playerName(players: readonly Player[], id: unknown): string {
        return players.find((p) => p.id === id)?.name ?? "?";
    }

    function describeEvent(
        event: GameEvent,
        players: readonly Player[],
    ): string | null {
        const payload = event.payload ?? {};
        switch (event.type) {
            case "cardPlayed": {
                const card = asCard(payload.card);
                return t("log_card_played", {
                    name: playerName(players, payload.playerId),
                    card: card ? cardLabel(card) : "?",
                });
            }
            case "ruleFired":
                return t("log_rule_fired", {
                    rule:
                        typeof payload.ruleName === "string"
                            ? payload.ruleName
                            : "?",
                });
            case "cardsDrawn":
                return t("log_cards_drawn", {
                    name: playerName(players, payload.playerId),
                    count:
                        typeof payload.count === "number" ? payload.count : 1,
                });
            case "directionReversed":
                return t("log_direction_reversed");
            case "playerSkipped":
                return t("log_player_skipped", {
                    name: playerName(players, payload.playerId),
                });
            case "turnAdvanced":
                return t("log_turn_advanced", {
                    name: playerName(players, payload.playerId),
                });
            case "gameEnded":
                return t("log_game_ended");
            default:
                return null;
        }
    }

    function start() {
        // Re-validate to strip editor-local keys and get a clean definition.
        const validated = validateEcaDefinition(definition);
        if (!validated.ok) return;
        const def = validated.definition;
        const players: Player[] = Array.from(
            { length: def.meta.minPlayers },
            (_, i) => ({
                id: `p${i + 1}`,
                name: t("test_player", { n: i + 1 }),
                seat: i,
            }),
        );
        const module = createEcaModule(def, "eca:draft");
        const state = createGame(module, players);
        setSandbox({
            module,
            players,
            state,
            log: [],
            nextId: 1,
            definitionJson: currentJson,
        });
        setRefusal(null);
    }

    function act(action: EcaAction) {
        if (!sandbox) return;
        const result = dispatch(
            sandbox.module,
            sandbox.state,
            action,
            action.playerId,
        );
        if (!result.ok) {
            setRefusal(
                isRefusalCode(result.error.code)
                    ? result.error.code
                    : "generic",
            );
            return;
        }
        setRefusal(null);
        let nextId = sandbox.nextId;
        const entries: LogEntry[] = [];
        for (const event of result.events) {
            const text = describeEvent(event, sandbox.players);
            if (text !== null) entries.push({ id: nextId++, text });
        }
        setSandbox({
            ...sandbox,
            state: result.state,
            // Newest first, capped so a long sandbox session stays light.
            log: [...entries.reverse(), ...sandbox.log].slice(0, 100),
            nextId,
        });
    }

    const over = sandbox ? sandbox.module.isOver(sandbox.state) : false;
    const topDiscard = sandbox
        ? (sandbox.state.discardPile[sandbox.state.discardPile.length - 1] ??
          null)
        : null;

    const seats: TestSeatState[] = sandbox
        ? sandbox.players.map((player) => {
              const cs = clientState(sandbox.module, sandbox.state, player.id);
              const hand =
                  cs.view.players.find((p) => p.id === player.id)?.hand ?? [];
              const playable = new Set(
                  cs.legalActions
                      .filter(
                          (
                              action,
                          ): action is Extract<
                              EcaAction,
                              { type: "playCard" }
                          > => action.type === "playCard",
                      )
                      .map((action) => cardKey(action.card)),
              );
              return {
                  player,
                  hand,
                  playable,
                  canDraw: cs.legalActions.some(
                      (action) => action.type === "drawCard",
                  ),
                  canPass: cs.legalActions.some(
                      (action) => action.type === "pass",
                  ),
                  isCurrent: sandbox.state.currentPlayerId === player.id,
              };
          })
        : [];

    const winnerNames = sandbox
        ? sandbox.state.winnerIds
              .map((id) => playerName(sandbox.players, id))
              .join(", ")
        : "";

    const currentName =
        sandbox && sandbox.state.currentPlayerId
            ? playerName(sandbox.players, sandbox.state.currentPlayerId)
            : null;

    const refusalText =
        refusal === null
            ? null
            : refusal === "generic"
              ? t("refuse_generic")
              : t(REFUSAL_KEYS[refusal]);

    return {
        sandbox,
        stale,
        over,
        topDiscard,
        seats,
        winnerNames,
        currentName,
        refusalText,
        start,
        act,
    };
}

export type TestPlayController = ReturnType<typeof useTestPlay>;
