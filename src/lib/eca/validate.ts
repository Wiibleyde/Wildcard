import { DECKS } from "@/lib/card/decks";
import { buildDeck } from "@/lib/engine/deck";
import {
    comparatorsFor,
    ECA_CARD_PROPS,
    ECA_CARD_SOURCES,
    ECA_COMPARATORS,
    ECA_DECK_IDS,
    ECA_DRAW_TARGETS,
    ECA_EFFECT_SPECS,
    ECA_EFFECT_TYPES,
    ECA_EVENT_TYPES,
    ECA_STAT_SOURCES,
    isOneOf,
    isRecord,
    literalFitsDomain,
    operandDomain,
} from "./schema";
import {
    ECA_DEFINITION_VERSION,
    type EcaCondition,
    type EcaDefinition,
    type EcaEffect,
    type EcaEventType,
    type EcaOperand,
    type EcaRule,
} from "./types";

/**
 * Untrusted JSON → {@link EcaDefinition}, rebuilt field by field (unknown keys
 * stripped). Reads use {@link validateEcaDefinition} (structure only, so rows
 * saved before a lint existed keep loading); every write uses
 * {@link validateEcaDefinitionForWrite} (structure + semantic lints).
 */

type EcaValidationErrorCode =
    | "not_object"
    | "invalid_version"
    | "invalid_name"
    | "invalid_description"
    | "invalid_players"
    | "invalid_deck"
    | "invalid_start_discard"
    | "invalid_hand_size"
    | "deal_exceeds_deck"
    | "invalid_turn_flag"
    | "invalid_rules"
    | "invalid_rule"
    | "invalid_rule_id"
    | "invalid_rule_name"
    | "invalid_event"
    | "invalid_conditions"
    | "too_many_conditions"
    | "invalid_condition"
    | "invalid_operand"
    | "played_card_scope"
    | "invalid_comparator"
    | "non_numeric_comparison"
    | "invalid_effects"
    | "invalid_effect"
    | "effect_event_mismatch"
    | "invalid_draw_target"
    | "invalid_draw_count"
    | "invalid_winner"
    | "duplicate_rule_id"
    | "invalid_win"
    | "no_accepting_rule"
    | "literal_too_long"
    | "unknown_rank_literal"
    | "unknown_suit_literal"
    | "literal_not_numeric"
    | "literal_out_of_range"
    | "constant_condition"
    | "incompatible_operands"
    | "missing_verdict"
    | "conflicting_verdict"
    | "reject_with_effects"
    | "unreachable_rule";

export interface EcaValidationError {
    readonly path: string;
    readonly code: EcaValidationErrorCode;
    /** English fallback for logs and API consumers; the UI translates by code. */
    readonly message: string;
}

type EcaValidationResult =
    | { readonly ok: true; readonly definition: EcaDefinition }
    | { readonly ok: false; readonly errors: readonly EcaValidationError[] };

export const ECA_NAME_MIN = 1;
export const ECA_NAME_MAX = 60;
export const ECA_DESCRIPTION_MAX = 300;
export const ECA_PLAYERS_MIN = 2;
export const ECA_PLAYERS_MAX = 8;
export const ECA_HAND_SIZE_MIN = 1;
export const ECA_HAND_SIZE_MAX = 26;
const ECA_RULES_MIN = 1;
export const ECA_RULES_MAX = 32;
const ECA_CONDITIONS_MAX = 8;
const ECA_EFFECTS_MIN = 1;
export const ECA_EFFECTS_MAX = 8;
export const ECA_DRAW_COUNT_MIN = 1;
export const ECA_DRAW_COUNT_MAX = 8;
export const ECA_RULE_NAME_MAX = 60;
const ECA_RULE_ID_MAX = 64;
const RULE_ID_PATTERN = /^[A-Za-z0-9_-]+$/;
/** Longest rank/suit is "diamonds" (8). */
const ECA_LITERAL_STRING_MAX = 16;

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

function parseName(value: unknown, min: number, max: number): string | null {
    if (typeof value !== "string") return null;
    const name = value.trim();
    return name.length >= min && name.length <= max ? name : null;
}

class Collector {
    readonly errors: EcaValidationError[] = [];

    add(path: string, code: EcaValidationErrorCode, message: string): void {
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
    const { kind, source, prop } = value;
    if (kind === "card") {
        if (!isOneOf(source, ECA_CARD_SOURCES)) {
            out.add(
                `${path}.source`,
                "invalid_operand",
                `Card operand source must be one of: ${ECA_CARD_SOURCES.join(", ")}.`,
            );
            return null;
        }
        if (!isOneOf(prop, ECA_CARD_PROPS)) {
            out.add(
                `${path}.prop`,
                "invalid_operand",
                `Card operand prop must be one of: ${ECA_CARD_PROPS.join(", ")}.`,
            );
            return null;
        }
        if (source === "playedCard" && event !== "cardPlayed") {
            out.add(
                `${path}.source`,
                "played_card_scope",
                "The playedCard operand is only available in cardPlayed rules.",
            );
            return null;
        }
        return { kind, source, prop };
    }
    if (kind === "stat") {
        if (!isOneOf(source, ECA_STAT_SOURCES)) {
            out.add(
                `${path}.source`,
                "invalid_operand",
                `Stat operand source must be one of: ${ECA_STAT_SOURCES.join(", ")}.`,
            );
            return null;
        }
        return { kind, source };
    }
    if (kind === "literal") {
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
        return { kind, value: literal };
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
    const op = value.op;
    if (!isOneOf(op, ECA_COMPARATORS)) {
        out.add(
            `${path}.op`,
            "invalid_comparator",
            `Comparator must be one of: ${ECA_COMPARATORS.join(", ")}.`,
        );
        return null;
    }
    if (lhs === null || rhs === null) return null;
    if (!comparatorsFor(lhs, rhs).includes(op)) {
        out.add(
            path,
            "non_numeric_comparison",
            `Comparator "${op}" requires numeric operands on both sides.`,
        );
        return null;
    }
    return { lhs, op, rhs };
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
    if (!isOneOf(type, ECA_EFFECT_TYPES)) {
        out.add(`${path}.type`, "invalid_effect", "Unknown effect type.");
        return null;
    }
    if (ECA_EFFECT_SPECS[type].cardPlayedOnly && event !== "cardPlayed") {
        out.add(
            `${path}.type`,
            "effect_event_mismatch",
            `Effect "${type}" is only valid in cardPlayed rules.`,
        );
        return null;
    }
    switch (type) {
        case "drawCards": {
            const { target, count } = value;
            if (!isOneOf(target, ECA_DRAW_TARGETS)) {
                out.add(
                    `${path}.target`,
                    "invalid_draw_target",
                    `drawCards target must be one of: ${ECA_DRAW_TARGETS.join(", ")}.`,
                );
                return null;
            }
            if (!isIntInRange(count, ECA_DRAW_COUNT_MIN, ECA_DRAW_COUNT_MAX)) {
                out.add(
                    `${path}.count`,
                    "invalid_draw_count",
                    `drawCards count must be an integer between ${ECA_DRAW_COUNT_MIN} and ${ECA_DRAW_COUNT_MAX}.`,
                );
                return null;
            }
            return { type, target, count };
        }
        case "endGame":
            if (value.winner !== "actor") {
                out.add(
                    `${path}.winner`,
                    "invalid_winner",
                    'endGame winner must be "actor".',
                );
                return null;
            }
            return { type, winner: "actor" };
        case "acceptCard":
        case "rejectCard":
        case "skipNextPlayer":
        case "reverseDirection":
        case "playAgain":
            return { type };
    }
}

function parseList<T>(
    items: readonly unknown[],
    path: string,
    parse: (item: unknown, itemPath: string) => T | null,
): T[] | null {
    const parsed: T[] = [];
    let ok = true;
    items.forEach((item, i) => {
        const result = parse(item, `${path}[${i}]`);
        if (result === null) ok = false;
        else parsed.push(result);
    });
    return ok ? parsed : null;
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
    const id = value.id;
    const idOk = typeof id === "string" && id.length > 0;
    if (!idOk) {
        out.add(
            `${path}.id`,
            "invalid_rule_id",
            "Rule id must be a non-empty string.",
        );
    }
    const name = parseName(value.name, 1, ECA_RULE_NAME_MAX);
    if (name === null) {
        out.add(
            `${path}.name`,
            "invalid_rule_name",
            `Rule name must be 1..${ECA_RULE_NAME_MAX} characters.`,
        );
    }
    const event = value.event;
    if (!isOneOf(event, ECA_EVENT_TYPES)) {
        // Condition and effect legality depend on the event.
        out.add(
            `${path}.event`,
            "invalid_event",
            `Rule event must be one of: ${ECA_EVENT_TYPES.join(", ")}.`,
        );
        return null;
    }

    let conditions: EcaCondition[] | null = null;
    if (!Array.isArray(value.conditions)) {
        out.add(
            `${path}.conditions`,
            "invalid_conditions",
            "Rule conditions must be an array.",
        );
    } else if (value.conditions.length > ECA_CONDITIONS_MAX) {
        // Capped before parsing: cost must not scale with an unbounded array.
        out.add(
            `${path}.conditions`,
            "too_many_conditions",
            `Rule conditions must be an array of at most ${ECA_CONDITIONS_MAX} conditions.`,
        );
    } else {
        conditions = parseList(
            value.conditions,
            `${path}.conditions`,
            (item, itemPath) => parseCondition(item, itemPath, event, out),
        );
    }

    let effects: EcaEffect[] | null = null;
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
    } else {
        effects = parseList(
            value.effects,
            `${path}.effects`,
            (item, itemPath) => parseEffect(item, itemPath, event, out),
        );
    }

    if (!idOk || name === null || conditions === null || effects === null) {
        return null;
    }
    return { id, name, event, conditions, effects };
}

function parseMeta(
    value: unknown,
    out: Collector,
): EcaDefinition["meta"] | null {
    if (!isRecord(value)) {
        out.add("meta", "not_object", "meta must be an object.");
        return null;
    }
    const name = parseName(value.name, ECA_NAME_MIN, ECA_NAME_MAX);
    if (name === null) {
        out.add(
            "meta.name",
            "invalid_name",
            `Name must be ${ECA_NAME_MIN}..${ECA_NAME_MAX} characters.`,
        );
    }
    const { description, minPlayers, maxPlayers } = value;
    const descriptionOk =
        description === undefined ||
        (typeof description === "string" &&
            description.length <= ECA_DESCRIPTION_MAX);
    if (!descriptionOk) {
        out.add(
            "meta.description",
            "invalid_description",
            `Description must be at most ${ECA_DESCRIPTION_MAX} characters.`,
        );
    }
    const playersOk =
        isIntInRange(minPlayers, ECA_PLAYERS_MIN, ECA_PLAYERS_MAX) &&
        isIntInRange(maxPlayers, ECA_PLAYERS_MIN, ECA_PLAYERS_MAX) &&
        minPlayers <= maxPlayers;
    if (!playersOk) {
        out.add(
            "meta",
            "invalid_players",
            `minPlayers/maxPlayers must be integers in ${ECA_PLAYERS_MIN}..${ECA_PLAYERS_MAX} with min ≤ max.`,
        );
    }
    if (
        name === null ||
        !descriptionOk ||
        !isIntInRange(minPlayers, ECA_PLAYERS_MIN, ECA_PLAYERS_MAX) ||
        !isIntInRange(maxPlayers, ECA_PLAYERS_MIN, ECA_PLAYERS_MAX) ||
        minPlayers > maxPlayers
    ) {
        return null;
    }
    return {
        name,
        ...(typeof description === "string" && description.length > 0
            ? { description }
            : {}),
        minPlayers,
        maxPlayers,
    };
}

function parseSetup(
    value: unknown,
    out: Collector,
): EcaDefinition["setup"] | null {
    if (!isRecord(value)) {
        out.add("setup", "not_object", "setup must be an object.");
        return null;
    }
    const { deckId, handSize, startDiscard } = value;
    if (!isOneOf(deckId, ECA_DECK_IDS)) {
        out.add(
            "setup.deckId",
            "invalid_deck",
            `deckId must be one of: ${ECA_DECK_IDS.join(", ")}.`,
        );
    }
    if (typeof startDiscard !== "boolean") {
        out.add(
            "setup.startDiscard",
            "invalid_start_discard",
            "startDiscard must be a boolean.",
        );
    }
    if (!isIntInRange(handSize, ECA_HAND_SIZE_MIN, ECA_HAND_SIZE_MAX)) {
        out.add(
            "setup.handSize",
            "invalid_hand_size",
            `handSize must be an integer in ${ECA_HAND_SIZE_MIN}..${ECA_HAND_SIZE_MAX}.`,
        );
    }
    if (
        !isOneOf(deckId, ECA_DECK_IDS) ||
        typeof startDiscard !== "boolean" ||
        !isIntInRange(handSize, ECA_HAND_SIZE_MIN, ECA_HAND_SIZE_MAX)
    ) {
        return null;
    }
    return { deckId, handSize, startDiscard };
}

function parseTurn(
    value: unknown,
    out: Collector,
): EcaDefinition["turn"] | null {
    if (!isRecord(value)) {
        out.add("turn", "not_object", "turn must be an object.");
        return null;
    }
    const { allowDraw, allowPass, passRequiresDraw, reshuffleDiscard } = value;
    const flags = { allowDraw, allowPass, passRequiresDraw, reshuffleDiscard };
    for (const [flag, flagValue] of Object.entries(flags)) {
        if (typeof flagValue !== "boolean") {
            out.add(
                `turn.${flag}`,
                "invalid_turn_flag",
                `turn.${flag} must be a boolean.`,
            );
        }
    }
    if (
        typeof allowDraw !== "boolean" ||
        typeof allowPass !== "boolean" ||
        typeof passRequiresDraw !== "boolean" ||
        typeof reshuffleDiscard !== "boolean"
    ) {
        return null;
    }
    return { allowDraw, allowPass, passRequiresDraw, reshuffleDiscard };
}

function parseRules(value: unknown, out: Collector): EcaRule[] | null {
    if (
        !Array.isArray(value) ||
        value.length < ECA_RULES_MIN ||
        value.length > ECA_RULES_MAX
    ) {
        out.add(
            "rules",
            "invalid_rules",
            `rules must be an array of ${ECA_RULES_MIN}..${ECA_RULES_MAX} rules.`,
        );
        return null;
    }
    const seenIds = new Set<string>();
    return parseList(value, "rules", (item, path) => {
        const rule = parseRule(item, path, out);
        if (rule === null) return null;
        if (seenIds.has(rule.id)) {
            out.add(
                `${path}.id`,
                "duplicate_rule_id",
                `Rule id "${rule.id}" is used more than once.`,
            );
            return null;
        }
        seenIds.add(rule.id);
        return rule;
    });
}

/** Returns every error found, so the editor can annotate all fields at once. */
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

    const meta = parseMeta(input.meta, out);
    let setup = parseSetup(input.setup, out);
    if (meta && setup) {
        const deckSize = buildDeck(DECKS[setup.deckId]).length;
        const needed =
            setup.handSize * meta.maxPlayers + (setup.startDiscard ? 1 : 0);
        if (needed > deckSize) {
            out.add(
                "setup.handSize",
                "deal_exceeds_deck",
                `Dealing ${setup.handSize} cards to ${meta.maxPlayers} players` +
                    `${setup.startDiscard ? " plus the start discard" : ""} needs ${needed} cards — the ${setup.deckId} deck has ${deckSize}.`,
            );
            setup = null;
        }
    }
    const turn = parseTurn(input.turn, out);
    const rules = parseRules(input.rules, out);

    let win: EcaDefinition["win"] | null = null;
    if (isRecord(input.win) && input.win.condition === "emptyHand") {
        win = { condition: "emptyHand" };
    } else {
        out.add(
            "win",
            "invalid_win",
            'win.condition must be "emptyHand" (v1).',
        );
    }

    if (
        out.errors.length > 0 ||
        meta === null ||
        setup === null ||
        turn === null ||
        rules === null ||
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

function sameOperand(a: EcaOperand, b: EcaOperand): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
}

/** A literal the other side can never take makes the condition constant. */
function lintLiteral(
    literal: string | number,
    counterpart: EcaOperand,
    path: string,
    definition: EcaDefinition,
    out: Collector,
): void {
    const { deckId } = definition.setup;
    const domain = operandDomain(counterpart);
    if (domain === null || literalFitsDomain(literal, domain, deckId)) {
        if (
            typeof literal === "number" &&
            !literalInRange(literal, counterpart, definition)
        ) {
            out.add(
                path,
                "literal_out_of_range",
                "This number is outside what the other side can ever be — the condition is constant.",
            );
        }
        return;
    }
    switch (domain) {
        case "rank":
            out.add(
                path,
                "unknown_rank_literal",
                `Rank literal must be one of the deck's ranks: ${DECKS[deckId].ranks.join(", ")}.`,
            );
            return;
        case "suit":
            out.add(
                path,
                "unknown_suit_literal",
                `Suit literal must be one of: ${DECKS[deckId].suits.join(", ")}.`,
            );
            return;
        case "number":
            out.add(
                path,
                "literal_not_numeric",
                "A literal compared with a number must be a number.",
            );
    }
}

/** Whether a number is a value the numeric `counterpart` can reach. */
function literalInRange(
    literal: number,
    counterpart: EcaOperand,
    definition: EcaDefinition,
): boolean {
    if (counterpart.kind === "card" && counterpart.prop === "value") {
        const top = DECKS[definition.setup.deckId].ranks.length - 1;
        return literal >= 0 && literal <= top;
    }
    if (counterpart.kind === "stat") {
        const deckSize = buildDeck(DECKS[definition.setup.deckId]).length;
        return literal >= 0 && literal <= deckSize;
    }
    return true;
}

function lintCondition(
    condition: EcaCondition,
    path: string,
    definition: EcaDefinition,
    out: Collector,
): void {
    const { lhs, rhs } = condition;
    const sides = [
        [lhs, rhs, `${path}.lhs`],
        [rhs, lhs, `${path}.rhs`],
    ] as const;
    let tooLong = false;
    for (const [operand, , operandPath] of sides) {
        if (
            operand.kind === "literal" &&
            typeof operand.value === "string" &&
            operand.value.length > ECA_LITERAL_STRING_MAX
        ) {
            out.add(
                `${operandPath}.value`,
                "literal_too_long",
                `String literals are at most ${ECA_LITERAL_STRING_MAX} characters.`,
            );
            tooLong = true;
        }
    }
    if (tooLong) return;
    if (
        (lhs.kind === "literal" && rhs.kind === "literal") ||
        sameOperand(lhs, rhs)
    ) {
        out.add(
            path,
            "constant_condition",
            "Both sides are fixed values or the same value — the condition never depends on the game.",
        );
        return;
    }
    for (const [operand, counterpart, operandPath] of sides) {
        if (operand.kind === "literal") {
            lintLiteral(
                operand.value,
                counterpart,
                operandPath,
                definition,
                out,
            );
        }
    }
    const lhsDomain = operandDomain(lhs);
    const rhsDomain = operandDomain(rhs);
    if (lhsDomain !== null && rhsDomain !== null && lhsDomain !== rhsDomain) {
        out.add(
            path,
            "incompatible_operands",
            `Comparing a ${lhsDomain} with a ${rhsDomain} can never match.`,
        );
    }
}

/**
 * A cardPlayed rule needs exactly one verdict, and a refusal changes nothing,
 * so `rejectCard` cannot carry other effects.
 */
function lintVerdict(rule: EcaRule, path: string, out: Collector): void {
    const accepts = rule.effects.filter((e) => e.type === "acceptCard").length;
    const rejects = rule.effects.filter((e) => e.type === "rejectCard").length;
    if (accepts + rejects === 0) {
        out.add(
            `${path}.effects`,
            "missing_verdict",
            "A cardPlayed rule must accept or reject the card (exactly one of acceptCard / rejectCard).",
        );
    } else if (accepts + rejects > 1) {
        out.add(
            `${path}.effects`,
            "conflicting_verdict",
            "A cardPlayed rule must contain exactly one acceptCard or rejectCard.",
        );
    } else if (rejects === 1 && rule.effects.length > 1) {
        out.add(
            `${path}.effects`,
            "reject_with_effects",
            "A refused card changes nothing — rejectCard cannot carry other effects.",
        );
    }
}

function lintForWrite(definition: EcaDefinition, out: Collector): void {
    // First condition-less cardPlayed rule: every cardPlayed rule below it is dead.
    let catchAll: number | null = null;

    definition.rules.forEach((rule, i) => {
        const path = `rules[${i}]`;
        if (
            rule.id.length > ECA_RULE_ID_MAX ||
            !RULE_ID_PATTERN.test(rule.id)
        ) {
            out.add(
                `${path}.id`,
                "invalid_rule_id",
                `Rule id must be 1..${ECA_RULE_ID_MAX} characters among letters, digits, "-" and "_".`,
            );
        }
        rule.conditions.forEach((condition, j) => {
            lintCondition(
                condition,
                `${path}.conditions[${j}]`,
                definition,
                out,
            );
        });
        if (rule.event !== "cardPlayed") return;
        lintVerdict(rule, path, out);
        if (catchAll !== null) {
            out.add(
                path,
                "unreachable_rule",
                `This rule can never apply: rule ${catchAll + 1} above has no condition and catches every card.`,
            );
        } else if (rule.conditions.length === 0) {
            catchAll = i;
        }
    });

    const accepts = definition.rules.some(
        (rule) =>
            rule.event === "cardPlayed" &&
            rule.effects.some((e) => e.type === "acceptCard"),
    );
    if (!accepts) {
        out.add(
            "rules",
            "no_accepting_rule",
            "At least one cardPlayed rule must contain an acceptCard effect.",
        );
    }
}

export function validateEcaDefinitionForWrite(
    input: unknown,
): EcaValidationResult {
    const parsed = validateEcaDefinition(input);
    if (!parsed.ok) return parsed;
    const out = new Collector();
    lintForWrite(parsed.definition, out);
    return out.errors.length > 0 ? { ok: false, errors: out.errors } : parsed;
}
