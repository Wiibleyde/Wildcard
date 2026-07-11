"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { GameButton } from "@/components/ui/GameButton";
import type { CardDescriptor, Suit } from "@/lib/card/types";
import { cardKey } from "@/lib/card/utils";
import {
    createEcaModule,
    type EcaAction,
    type EcaDefinition,
    type EcaState,
    type EcaView,
    validateEcaDefinition,
} from "@/lib/eca";
import { clientState, createGame, dispatch } from "@/lib/engine/runner";
import type { GameEvent, GameModule, Player } from "@/lib/engine/types";

/**
 * Studio sandbox: the current draft becomes a real {@link GameModule}
 * (`eca:draft`) driven through the REAL runner — `createGame`, `dispatch`,
 * `clientState` — exactly like a native game. The creator plays every seat;
 * each seat's hand is rendered from that seat's own redacted view, so the
 * projection layer is exercised too. Nothing here is a simulation shortcut:
 * if it works in the sandbox, it works in a match.
 */

const SUIT_GLYPH: Record<Suit, string> = {
    spades: "♠",
    hearts: "♥",
    diamonds: "♦",
    clubs: "♣",
};

function cardLabel(card: CardDescriptor): string {
    return card.type === "suited"
        ? `${card.rank}${SUIT_GLYPH[card.suit]}`
        : "?";
}

function isRedSuit(card: CardDescriptor): boolean {
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

interface LogEntry {
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

interface Props {
    readonly definition: EcaDefinition;
    readonly valid: boolean;
}

export function TestPlay({ definition, valid }: Props) {
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

    const seats = sandbox
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

    return (
        <section className="panel-d flex flex-col gap-4 p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-3">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <h2 className="font-display text-xl text-wc-cream">
                        {t("test_title")}
                    </h2>
                    <p className="sub text-xs">{t("test_subtitle")}</p>
                </div>
                <GameButton
                    variant="green"
                    size="sm"
                    onClick={start}
                    disabled={!valid}
                >
                    {sandbox ? t("test_restart") : t("test_start")}
                </GameButton>
            </div>

            {!valid && (
                <p
                    className="rounded-xl px-4 py-3 text-sm font-bold"
                    style={{
                        background: "var(--red)",
                        border: "2.5px solid var(--ink)",
                        color: "var(--accent-ink)",
                    }}
                >
                    {t("test_invalid")}
                </p>
            )}

            {sandbox && stale && (
                <p
                    className="rounded-xl px-4 py-3 text-sm font-bold"
                    style={{
                        background: "var(--gold)",
                        border: "2.5px solid var(--ink)",
                        color: "var(--ink)",
                    }}
                >
                    {t("test_stale")}
                </p>
            )}

            {sandbox && (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                    <div className="flex flex-col gap-4 lg:col-span-2">
                        {/* Table center: stock, discard, direction, turn. */}
                        <div className="flex flex-wrap items-center gap-3">
                            <span
                                className="stamp"
                                style={{
                                    background: "var(--cream2)",
                                    color: "var(--ink)",
                                }}
                            >
                                {t("test_draw_pile")}{" "}
                                {sandbox.state.drawPile.length}
                            </span>
                            <span
                                className="stamp"
                                style={{
                                    background: "var(--cream)",
                                    color:
                                        topDiscard && isRedSuit(topDiscard)
                                            ? "var(--red)"
                                            : "var(--ink)",
                                }}
                            >
                                {t("test_discard")}{" "}
                                {topDiscard
                                    ? cardLabel(topDiscard)
                                    : t("test_discard_empty")}
                            </span>
                            <span
                                className="stamp"
                                style={{
                                    background: "var(--purple)",
                                    color: "var(--accent-ink)",
                                }}
                            >
                                {t("test_direction")}{" "}
                                {sandbox.state.direction === 1 ? "→" : "←"}
                            </span>
                            {!over && sandbox.state.currentPlayerId && (
                                <span
                                    className="stamp"
                                    style={{
                                        background: "var(--gold)",
                                        color: "var(--ink)",
                                    }}
                                >
                                    {t("test_current", {
                                        name: playerName(
                                            sandbox.players,
                                            sandbox.state.currentPlayerId,
                                        ),
                                    })}
                                </span>
                            )}
                        </div>

                        {over && (
                            <p
                                className="rounded-xl px-4 py-3 text-sm font-bold"
                                style={{
                                    background: "var(--green)",
                                    border: "2.5px solid var(--ink)",
                                    boxShadow: "0 4px 0 var(--ink)",
                                    color: "var(--ink)",
                                }}
                            >
                                {t("test_winner", { names: winnerNames })}
                            </p>
                        )}

                        {refusal !== null && (
                            <p
                                className="text-xs font-bold"
                                style={{ color: "var(--red)" }}
                            >
                                {refusal === "generic"
                                    ? t("refuse_generic")
                                    : t(REFUSAL_KEYS[refusal])}
                            </p>
                        )}

                        {/* One panel per seat, rendered from that seat's view. */}
                        <div className="flex flex-col gap-3">
                            {seats.map((seat) => (
                                <div
                                    key={seat.player.id}
                                    className="flex flex-col gap-2 rounded-xl p-3"
                                    style={{
                                        background: "var(--panel-d2)",
                                        border: `2.5px solid ${seat.isCurrent && !over ? "var(--gold)" : "var(--ink)"}`,
                                    }}
                                >
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-display text-sm text-wc-cream">
                                            {seat.player.name}
                                        </span>
                                        {seat.isCurrent && !over && (
                                            <span
                                                className="stamp"
                                                style={{
                                                    background: "var(--gold)",
                                                    color: "var(--ink)",
                                                }}
                                            >
                                                ▶
                                            </span>
                                        )}
                                        <div className="ml-auto flex gap-2">
                                            <GameButton
                                                variant="teal"
                                                size="sm"
                                                onClick={() =>
                                                    act({
                                                        type: "drawCard",
                                                        playerId:
                                                            seat.player.id,
                                                    })
                                                }
                                                disabled={!seat.canDraw || over}
                                            >
                                                {t("test_draw")}
                                            </GameButton>
                                            <GameButton
                                                variant="ghost"
                                                size="sm"
                                                onClick={() =>
                                                    act({
                                                        type: "pass",
                                                        playerId:
                                                            seat.player.id,
                                                    })
                                                }
                                                disabled={!seat.canPass || over}
                                            >
                                                {t("test_pass")}
                                            </GameButton>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {seat.hand.map((card) => {
                                            const key = cardKey(card);
                                            return (
                                                <button
                                                    key={key}
                                                    type="button"
                                                    onClick={() =>
                                                        act({
                                                            type: "playCard",
                                                            playerId:
                                                                seat.player.id,
                                                            card,
                                                        })
                                                    }
                                                    disabled={
                                                        over ||
                                                        !seat.playable.has(key)
                                                    }
                                                    className="wc-chip rounded-lg px-2 py-1.5 text-sm font-bold disabled:opacity-40"
                                                    style={{
                                                        background:
                                                            "var(--cream)",
                                                        border: "2px solid var(--ink)",
                                                        boxShadow:
                                                            "0 2px 0 var(--ink)",
                                                        color: isRedSuit(card)
                                                            ? "var(--red)"
                                                            : "var(--ink)",
                                                    }}
                                                >
                                                    {cardLabel(card)}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Event log — bounded height, scrolls inside. */}
                    <div className="flex flex-col gap-2">
                        <h3 className="font-display text-sm text-wc-cream">
                            {t("test_log_title")}
                        </h3>
                        <div
                            className="flex h-64 flex-col gap-1 overflow-y-auto rounded-xl p-3 lg:h-80"
                            style={{
                                background: "var(--panel-d2)",
                                border: "2.5px solid var(--ink)",
                            }}
                        >
                            {sandbox.log.length === 0 && (
                                <p className="sub text-xs">
                                    {t("test_log_empty")}
                                </p>
                            )}
                            {sandbox.log.map((entry) => (
                                <p
                                    key={entry.id}
                                    className="text-xs font-semibold"
                                    style={{ color: "var(--muted)" }}
                                >
                                    {entry.text}
                                </p>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
