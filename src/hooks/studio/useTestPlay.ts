"use client";

import { useTranslations } from "next-intl";
import { useMemo, useRef, useState } from "react";
import type { CardDescriptor } from "@/lib/card/types";
import { cardKey } from "@/lib/card/utils";
import { describeEcaEvent } from "@/lib/eca/display";
import { topOfDiscard } from "@/lib/eca/interpreter";
import { createEcaModule } from "@/lib/eca/module";
import type {
    EcaAction,
    EcaDefinition,
    EcaState,
    EcaView,
} from "@/lib/eca/types";
import { clientState, createGame, dispatch } from "@/lib/engine/runner";
import type { GameModule, Player } from "@/lib/engine/types";

/**
 * Studio sandbox: the definition runs through the real runner, and each seat
 * reads its own redacted view, so the projection layer is exercised too.
 */

const SANDBOX_MODULE_ID = "eca:draft";
const LOG_CAP = 100;

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
    /** The definition it was dealt with, for the staleness check. */
    readonly definitionJson: string;
}

export interface TestSeatState {
    readonly player: Player;
    readonly hand: readonly CardDescriptor[];
    readonly playable: ReadonlySet<string>;
    readonly canDraw: boolean;
    readonly canPass: boolean;
    readonly isCurrent: boolean;
}

const REFUSAL_KEYS = {
    illegal_card: "refuse_illegal_card",
    not_your_turn: "refuse_not_your_turn",
    cannot_draw: "refuse_cannot_draw",
    cannot_pass: "refuse_cannot_pass",
} as const;

type RefusalCode = keyof typeof REFUSAL_KEYS;

function isRefusalCode(code: string): code is RefusalCode {
    return Object.hasOwn(REFUSAL_KEYS, code);
}

function playerName(players: readonly Player[], id: unknown): string {
    return players.find((p) => p.id === id)?.name ?? "?";
}

function seatStates(sandbox: Sandbox): TestSeatState[] {
    return sandbox.players.map((player) => {
        const cs = clientState(sandbox.module, sandbox.state, player.id);
        const playable = new Set<string>();
        for (const action of cs.legalActions) {
            if (action.type === "playCard") playable.add(cardKey(action.card));
        }
        return {
            player,
            hand: cs.view.players.find((p) => p.id === player.id)?.hand ?? [],
            playable,
            canDraw: cs.legalActions.some((a) => a.type === "drawCard"),
            canPass: cs.legalActions.some((a) => a.type === "pass"),
            isCurrent: sandbox.state.currentPlayerId === player.id,
        };
    });
}

/** `definition` is the validated one, or `null` while the draft is invalid. */
export function useTestPlay(definition: EcaDefinition | null) {
    const t = useTranslations("studio");
    const [sandbox, setSandbox] = useState<Sandbox | null>(null);
    // Read synchronously so two quick clicks each apply to the latest state.
    const sandboxRef = useRef<Sandbox | null>(null);
    const [refusal, setRefusal] = useState<RefusalCode | "generic" | null>(
        null,
    );

    function commit(next: Sandbox) {
        sandboxRef.current = next;
        setSandbox(next);
    }

    const currentJson = useMemo(
        () => (definition ? JSON.stringify(definition) : null),
        [definition],
    );
    const stale = sandbox !== null && sandbox.definitionJson !== currentJson;

    function start() {
        if (definition === null || currentJson === null) return;
        const players: Player[] = Array.from(
            { length: definition.meta.minPlayers },
            (_, i) => ({
                id: `p${i + 1}`,
                name: t("test_player", { n: i + 1 }),
                seat: i,
            }),
        );
        const module = createEcaModule(definition, SANDBOX_MODULE_ID);
        commit({
            module,
            players,
            state: createGame(module, players),
            log: [],
            nextId: 1,
            definitionJson: currentJson,
        });
        setRefusal(null);
    }

    function act(action: EcaAction) {
        const current = sandboxRef.current;
        if (!current) return;
        const result = dispatch(
            current.module,
            current.state,
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
        let nextId = current.nextId;
        const entries: LogEntry[] = [];
        for (const event of result.events) {
            const text = describeEcaEvent(event, t, (id) =>
                playerName(current.players, id),
            );
            if (text !== null) entries.push({ id: nextId++, text });
        }
        commit({
            ...current,
            state: result.state,
            log: [...entries.reverse(), ...current.log].slice(0, LOG_CAP),
            nextId,
        });
    }

    const seats = useMemo(
        () => (sandbox ? seatStates(sandbox) : []),
        [sandbox],
    );

    const state = sandbox?.state ?? null;
    const over = sandbox ? sandbox.module.isOver(sandbox.state) : false;
    const winnerNames = sandbox
        ? sandbox.state.winnerIds
              .map((id) => playerName(sandbox.players, id))
              .join(", ")
        : "";
    const currentName = sandbox?.state.currentPlayerId
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
        topDiscard: state ? topOfDiscard(state.discardPile) : null,
        seats,
        winnerNames,
        currentName,
        refusalText,
        start,
        act,
    };
}
