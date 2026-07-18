import { DECKS } from "@/lib/card/decks";
import { buildDeck } from "@/lib/engine/deck";
import {
    ECA_DEFINITION_VERSION,
    type EcaCardProp,
    type EcaComparator,
    type EcaCondition,
    type EcaDeckId,
    type EcaDefinition,
    type EcaEffect,
    type EcaEventType,
    type EcaOperand,
    type EcaRule,
} from "./types";

/**
 * Structural + semantic validation of an ECA definition. The input is
 * untrusted JSON (Studio editor state, API request body, database row):
 * everything is narrowed from `unknown` — no cast, no `any`. On success the
 * definition is REBUILT field by field, so unknown extra keys are stripped
 * and the returned object is exactly an {@link EcaDefinition}.
 *
 * Errors carry a machine-readable `code` (the UI translates by code) plus an
 * English `message` and a JSON-path-ish `path` for pinpointing the field.
 */

export interface EcaValidationError {
    readonly path: string;
    readonly code: string;
    readonly message: string;
}

export type EcaValidationResult =
    | { readonly ok: true; readonly definition: EcaDefinition }
    | { readonly ok: false; readonly errors: readonly EcaValidationError[] };

// ── Limits (named so the editor UI can display them) ─────────────────────────

export const ECA_NAME_MIN = 1;
export const ECA_NAME_MAX = 60;
export const ECA_DESCRIPTION_MAX = 300;
export const ECA_PLAYERS_MIN = 2;
export const ECA_PLAYERS_MAX = 8;
export const ECA_HAND_SIZE_MIN = 1;
export const ECA_HAND_SIZE_MAX = 26;
export const ECA_RULES_MIN = 1;
export const ECA_RULES_MAX = 32;
export const ECA_CONDITIONS_MAX = 8;
export const ECA_EFFECTS_MIN = 1;
export const ECA_EFFECTS_MAX = 8;
export const ECA_DRAW_COUNT_MIN = 1;
export const ECA_DRAW_COUNT_MAX = 8;
export const ECA_RULE_NAME_MAX = 60;

const ECA_DECK_IDS: readonly EcaDeckId[] = ["french52", "french32"];
const EVENT_TYPES: readonly EcaEventType[] = ["cardPlayed", "turnStarted"];
const CARD_PROPS: readonly EcaCardProp[] = ["rank", "suit", "value"];
const CARD_SOURCES = ["playedCard", "topDiscard"] as const;
const STAT_SOURCES = [
    "actorHandCount",
    "drawPileCount",
    "discardPileCount",
] as const;
const COMPARATORS: readonly EcaComparator[] = [
    "eq",
    "neq",
    "gt",
    "gte",
    "lt",
    "lte",
];
const NUMERIC_COMPARATORS: readonly EcaComparator[] = [
    "gt",
    "gte",
    "lt",
    "lte",
];
const DRAW_TARGETS = ["actor", "nextPlayer"] as const;
/** Effects that only make sense as a response to a played card. */
const CARD_PLAYED_ONLY_EFFECTS = ["acceptCard", "rejectCard", "playAgain"];

// ── Narrowing helpers ────────────────────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOneOf<T extends string>(
    value: unknown,
    options: readonly T[],
): value is T {
    return (
        typeof value === "string" &&
        (options as readonly string[]).includes(value)
    );
}

function isIntInRange(
    value: unknown,
    min: number,
    max: number,
): value is number {
    return (
        typeof value === "number" &&
        Number.isInteger(value) &&
        value >= min &&
        value <= max
    );
}

/** Whether an operand always evaluates to a number (for gt/gte/lt/lte). */
function isNumericOperand(operand: EcaOperand): boolean {
    switch (operand.kind) {
        case "card":
            return operand.prop === "value";
        case "stat":
            return true;
        case "literal":
            return typeof operand.value === "number";
    }
}

// ── Validator ────────────────────────────────────────────────────────────────

class Collector {
    readonly errors: EcaValidationError[] = [];

    add(path: string, code: string, message: string): void {
        this.errors.push({ path, code, message });
    }
}

function parseOperand(
    value: unknown,
    path: string,
    event: EcaEventType,
    out: Collector,
): EcaOperand | null {
    if (!isRecord(value)) {
        out.add(path, "invalid_operand", "Operand must be an object.");
        return null;
    }
    if (value.kind === "card") {
        if (!isOneOf(value.source, CARD_SOURCES)) {
            out.add(
                `${path}.source`,
                "invalid_operand",
                "Card operand source must be playedCard or topDiscard.",
            );
            return null;
        }
        if (!isOneOf(value.prop, CARD_PROPS)) {
            out.add(
                `${path}.prop`,
                "invalid_operand",
                "Card operand prop must be rank, suit or value.",
            );
            return null;
        }
        if (value.source === "playedCard" && event !== "cardPlayed") {
            out.add(
                `${path}.source`,
                "played_card_scope",
                "The playedCard operand is only available in cardPlayed rules.",
            );
            return null;
        }
        return { kind: "card", source: value.source, prop: value.prop };
    }
    if (value.kind === "stat") {
        if (!isOneOf(value.source, STAT_SOURCES)) {
            out.add(
                `${path}.source`,
                "invalid_operand",
                "Stat operand source must be actorHandCount, drawPileCount or discardPileCount.",
            );
            return null;
        }
        return { kind: "stat", source: value.source };
    }
    if (value.kind === "literal") {
        const literal = value.value;
        if (
            typeof literal !== "string" &&
            (typeof literal !== "number" || !Number.isFinite(literal))
        ) {
            out.add(
                `${path}.value`,
                "invalid_operand",
                "Literal operand value must be a string or a finite number.",
            );
            return null;
        }
        return { kind: "literal", value: literal };
    }
    out.add(
        `${path}.kind`,
        "invalid_operand",
        "Operand kind must be card, stat or literal.",
    );
    return null;
}

function parseCondition(
    value: unknown,
    path: string,
    event: EcaEventType,
    out: Collector,
): EcaCondition | null {
    if (!isRecord(value)) {
        out.add(path, "invalid_condition", "Condition must be an object.");
        return null;
    }
    const lhs = parseOperand(value.lhs, `${path}.lhs`, event, out);
    const rhs = parseOperand(value.rhs, `${path}.rhs`, event, out);
    if (!isOneOf(value.op, COMPARATORS)) {
        out.add(
            `${path}.op`,
            "invalid_comparator",
            "Comparator must be one of eq, neq, gt, gte, lt, lte.",
        );
        return null;
    }
    if (lhs === null || rhs === null) return null;
    // gt/gte/lt/lte are order comparisons — both sides must be numeric
    // (a rank like "J" has no order; its `value` prop does).
    if (
        NUMERIC_COMPARATORS.includes(value.op) &&
        (!isNumericOperand(lhs) || !isNumericOperand(rhs))
    ) {
        out.add(
            path,
            "non_numeric_comparison",
            `Comparator "${value.op}" requires numeric operands on both sides.`,
        );
        return null;
    }
    return { lhs, op: value.op, rhs };
}

function parseEffect(
    value: unknown,
    path: string,
    event: EcaEventType,
    out: Collector,
): EcaEffect | null {
    if (!isRecord(value)) {
        out.add(path, "invalid_effect", "Effect must be an object.");
        return null;
    }
    const type = value.type;
    if (
        typeof type === "string" &&
        CARD_PLAYED_ONLY_EFFECTS.includes(type) &&
        event !== "cardPlayed"
    ) {
        out.add(
            `${path}.type`,
            "effect_event_mismatch",
            `Effect "${type}" is only valid in cardPlayed rules.`,
        );
        return null;
    }
    switch (type) {
        case "acceptCard":
        case "rejectCard":
        case "skipNextPlayer":
        case "reverseDirection":
        case "playAgain":
            return { type };
        case "drawCards": {
            if (!isOneOf(value.target, DRAW_TARGETS)) {
                out.add(
                    `${path}.target`,
                    "invalid_draw_target",
                    "drawCards target must be actor or nextPlayer.",
                );
                return null;
            }
            if (
                !isIntInRange(
                    value.count,
                    ECA_DRAW_COUNT_MIN,
                    ECA_DRAW_COUNT_MAX,
                )
            ) {
                out.add(
                    `${path}.count`,
                    "invalid_draw_count",
                    `drawCards count must be an integer between ${ECA_DRAW_COUNT_MIN} and ${ECA_DRAW_COUNT_MAX}.`,
                );
                return null;
            }
            return {
                type: "drawCards",
                target: value.target,
                count: value.count,
            };
        }
        case "endGame": {
            if (value.winner !== "actor") {
                out.add(
                    `${path}.winner`,
                    "invalid_winner",
                    'endGame winner must be "actor".',
                );
                return null;
            }
            return { type: "endGame", winner: "actor" };
        }
        default:
            out.add(`${path}.type`, "invalid_effect", "Unknown effect type.");
            return null;
    }
}

function parseRule(
    value: unknown,
    path: string,
    out: Collector,
): EcaRule | null {
    if (!isRecord(value)) {
        out.add(path, "invalid_rule", "Rule must be an object.");
        return null;
    }
    let broken = false;

    if (typeof value.id !== "string" || value.id.length === 0) {
        out.add(
            `${path}.id`,
            "invalid_rule_id",
            "Rule id must be a non-empty string.",
        );
        broken = true;
    }
    if (
        typeof value.name !== "string" ||
        value.name.length < 1 ||
        value.name.length > ECA_RULE_NAME_MAX
    ) {
        out.add(
            `${path}.name`,
            "invalid_rule_name",
            `Rule name must be 1..${ECA_RULE_NAME_MAX} characters.`,
        );
        broken = true;
    }
    if (!isOneOf(value.event, EVENT_TYPES)) {
        out.add(
            `${path}.event`,
            "invalid_event",
            "Rule event must be cardPlayed or turnStarted.",
        );
        // Conditions/effects legality depends on the event — stop here.
        return null;
    }
    const event = value.event;

    const conditions: EcaCondition[] = [];
    if (!Array.isArray(value.conditions)) {
        out.add(
            `${path}.conditions`,
            "invalid_conditions",
            "Rule conditions must be an array.",
        );
        broken = true;
    } else if (value.conditions.length > ECA_CONDITIONS_MAX) {
        // Cap BEFORE parsing each entry — an unbounded array must not cost
        // CPU/storage proportional to its length (DoS amplification).
        out.add(
            `${path}.conditions`,
            "too_many_conditions",
            `Rule conditions must be an array of at most ${ECA_CONDITIONS_MAX} conditions.`,
        );
        broken = true;
    } else {
        value.conditions.forEach((condition, i) => {
            const parsed = parseCondition(
                condition,
                `${path}.conditions[${i}]`,
                event,
                out,
            );
            if (parsed === null) broken = true;
            else conditions.push(parsed);
        });
    }

    const effects: EcaEffect[] = [];
    if (
        !Array.isArray(value.effects) ||
        value.effects.length < ECA_EFFECTS_MIN ||
        value.effects.length > ECA_EFFECTS_MAX
    ) {
        out.add(
            `${path}.effects`,
            "invalid_effects",
            `Rule effects must be an array of ${ECA_EFFECTS_MIN}..${ECA_EFFECTS_MAX} effects.`,
        );
        broken = true;
    } else {
        value.effects.forEach((effect, i) => {
            const parsed = parseEffect(
                effect,
                `${path}.effects[${i}]`,
                event,
                out,
            );
            if (parsed === null) broken = true;
            else effects.push(parsed);
        });
    }

    if (broken) return null;
    return {
        id: value.id as string,
        name: value.name as string,
        event,
        conditions,
        effects,
    };
}

/**
 * Validate untrusted input into an {@link EcaDefinition}. Returns EVERY error
 * found (not just the first) so the editor can annotate all invalid fields at
 * once.
 */
export function validateEcaDefinition(input: unknown): EcaValidationResult {
    const out = new Collector();

    if (!isRecord(input)) {
        out.add("", "not_object", "Definition must be a JSON object.");
        return { ok: false, errors: out.errors };
    }

    if (input.version !== ECA_DEFINITION_VERSION) {
        out.add(
            "version",
            "invalid_version",
            `Definition version must be ${ECA_DEFINITION_VERSION}.`,
        );
    }

    // ── meta ──
    let meta: EcaDefinition["meta"] | null = null;
    if (!isRecord(input.meta)) {
        out.add("meta", "not_object", "meta must be an object.");
    } else {
        const raw = input.meta;
        let ok = true;
        if (
            typeof raw.name !== "string" ||
            raw.name.length < ECA_NAME_MIN ||
            raw.name.length > ECA_NAME_MAX
        ) {
            out.add(
                "meta.name",
                "invalid_name",
                `Name must be ${ECA_NAME_MIN}..${ECA_NAME_MAX} characters.`,
            );
            ok = false;
        }
        if (
            raw.description !== undefined &&
            (typeof raw.description !== "string" ||
                raw.description.length > ECA_DESCRIPTION_MAX)
        ) {
            out.add(
                "meta.description",
                "invalid_description",
                `Description must be at most ${ECA_DESCRIPTION_MAX} characters.`,
            );
            ok = false;
        }
        if (
            !isIntInRange(raw.minPlayers, ECA_PLAYERS_MIN, ECA_PLAYERS_MAX) ||
            !isIntInRange(raw.maxPlayers, ECA_PLAYERS_MIN, ECA_PLAYERS_MAX) ||
            raw.minPlayers > raw.maxPlayers
        ) {
            out.add(
                "meta",
                "invalid_players",
                `minPlayers/maxPlayers must be integers in ${ECA_PLAYERS_MIN}..${ECA_PLAYERS_MAX} with min ≤ max.`,
            );
            ok = false;
        }
        if (ok) {
            meta = {
                name: raw.name as string,
                ...(typeof raw.description === "string" &&
                raw.description.length > 0
                    ? { description: raw.description }
                    : {}),
                minPlayers: raw.minPlayers as number,
                maxPlayers: raw.maxPlayers as number,
            };
        }
    }

    // ── setup ──
    let setup: EcaDefinition["setup"] | null = null;
    if (!isRecord(input.setup)) {
        out.add("setup", "not_object", "setup must be an object.");
    } else {
        const raw = input.setup;
        let ok = true;
        if (!isOneOf(raw.deckId, ECA_DECK_IDS)) {
            out.add(
                "setup.deckId",
                "invalid_deck",
                `deckId must be one of: ${ECA_DECK_IDS.join(", ")}.`,
            );
            ok = false;
        }
        if (typeof raw.startDiscard !== "boolean") {
            out.add(
                "setup.startDiscard",
                "invalid_start_discard",
                "startDiscard must be a boolean.",
            );
            ok = false;
        }
        if (!isIntInRange(raw.handSize, ECA_HAND_SIZE_MIN, ECA_HAND_SIZE_MAX)) {
            out.add(
                "setup.handSize",
                "invalid_hand_size",
                `handSize must be an integer in ${ECA_HAND_SIZE_MIN}..${ECA_HAND_SIZE_MAX}.`,
            );
            ok = false;
        }
        if (ok) {
            setup = {
                deckId: raw.deckId as EcaDeckId,
                handSize: raw.handSize as number,
                startDiscard: raw.startDiscard as boolean,
            };
        }
    }

    // Deal feasibility — needs valid meta AND setup.
    if (meta && setup) {
        const deckSize = buildDeck(DECKS[setup.deckId]).length;
        const needed =
            setup.handSize * meta.maxPlayers + (setup.startDiscard ? 1 : 0);
        if (needed > deckSize) {
            out.add(
                "setup.handSize",
                "invalid_hand_size",
                `Dealing ${setup.handSize} cards to ${meta.maxPlayers} players` +
                    `${setup.startDiscard ? " plus the start discard" : ""} needs ${needed} cards — the ${setup.deckId} deck has ${deckSize}.`,
            );
            setup = null;
        }
    }

    // ── turn ──
    let turn: EcaDefinition["turn"] | null = null;
    if (!isRecord(input.turn)) {
        out.add("turn", "not_object", "turn must be an object.");
    } else {
        const raw = input.turn;
        const flags = [
            "allowDraw",
            "allowPass",
            "passRequiresDraw",
            "reshuffleDiscard",
        ] as const;
        let ok = true;
        for (const flag of flags) {
            if (typeof raw[flag] !== "boolean") {
                out.add(
                    `turn.${flag}`,
                    "invalid_turn_flag",
                    `turn.${flag} must be a boolean.`,
                );
                ok = false;
            }
        }
        if (ok) {
            turn = {
                allowDraw: raw.allowDraw as boolean,
                allowPass: raw.allowPass as boolean,
                passRequiresDraw: raw.passRequiresDraw as boolean,
                reshuffleDiscard: raw.reshuffleDiscard as boolean,
            };
        }
    }

    // ── rules ──
    const rules: EcaRule[] = [];
    let rulesOk = true;
    if (
        !Array.isArray(input.rules) ||
        input.rules.length < ECA_RULES_MIN ||
        input.rules.length > ECA_RULES_MAX
    ) {
        out.add(
            "rules",
            "invalid_rules",
            `rules must be an array of ${ECA_RULES_MIN}..${ECA_RULES_MAX} rules.`,
        );
        rulesOk = false;
    } else {
        const seenIds = new Set<string>();
        input.rules.forEach((rule, i) => {
            const parsed = parseRule(rule, `rules[${i}]`, out);
            if (parsed === null) {
                rulesOk = false;
                return;
            }
            if (seenIds.has(parsed.id)) {
                out.add(
                    `rules[${i}].id`,
                    "duplicate_rule_id",
                    `Rule id "${parsed.id}" is used more than once.`,
                );
                rulesOk = false;
                return;
            }
            seenIds.add(parsed.id);
            rules.push(parsed);
        });

        // Without at least one accepting cardPlayed rule, no card is ever
        // playable — the game would be unwinnable by construction.
        if (
            rulesOk &&
            !rules.some(
                (rule) =>
                    rule.event === "cardPlayed" &&
                    rule.effects.some((e) => e.type === "acceptCard"),
            )
        ) {
            out.add(
                "rules",
                "no_accepting_rule",
                "At least one cardPlayed rule must contain an acceptCard effect.",
            );
            rulesOk = false;
        }
    }

    // ── win ──
    let win: EcaDefinition["win"] | null = null;
    if (!isRecord(input.win) || input.win.condition !== "emptyHand") {
        out.add(
            "win",
            "invalid_win",
            'win.condition must be "emptyHand" (v1).',
        );
    } else {
        win = { condition: "emptyHand" };
    }

    if (
        out.errors.length > 0 ||
        meta === null ||
        setup === null ||
        turn === null ||
        !rulesOk ||
        win === null
    ) {
        return { ok: false, errors: out.errors };
    }

    return {
        ok: true,
        definition: {
            version: ECA_DEFINITION_VERSION,
            meta,
            setup,
            turn,
            rules,
            win,
        },
    };
}
