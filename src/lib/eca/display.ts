import type { CardDescriptor, Suit } from "@/lib/card/types";
import type { GameEvent } from "@/lib/engine/types";

/**
 * Display helpers shared by every surface that narrates an ECA game — the
 * live table log (`src/lib/games/eca/table.ts`) and the Studio sandbox
 * (`useTestPlay`). One implementation, so the board a creator tests in reads
 * exactly like the one everyone plays on. Pure: safe on client and server.
 */

const SUIT_GLYPH: Record<Suit, string> = {
    spades: "♠",
    hearts: "♥",
    diamonds: "♦",
    clubs: "♣",
};

function isSuitedCard(
    value: unknown,
): value is Extract<CardDescriptor, { type: "suited" }> {
    if (typeof value !== "object" || value === null) return false;
    const record = value as Record<string, unknown>;
    return (
        record.type === "suited" &&
        typeof record.rank === "string" &&
        typeof record.suit === "string" &&
        Object.hasOwn(SUIT_GLYPH, record.suit)
    );
}

/** "7♥" for a suited card; "?" for anything face-down/unknown (log lines). */
export function ecaCardLabel(value: unknown): string {
    return isSuitedCard(value) ? `${value.rank}${SUIT_GLYPH[value.suit]}` : "?";
}

/** Hearts and diamonds render red. */
export function isRedSuit(card: CardDescriptor): boolean {
    return (
        card.type === "suited" &&
        (card.suit === "hearts" || card.suit === "diamonds")
    );
}

/**
 * Localized text lookup — both the `game` and the `studio` namespaces carry
 * the same `log_*` keys, so either translator fits.
 */
export type EcaLogText = (
    key: string,
    values?: Record<string, string | number>,
) => string;

/**
 * One log line for an ECA engine event, or `null` for events with no line.
 * `nameOf` resolves a payload's `playerId` to a display name ("?" if unknown).
 */
export function describeEcaEvent(
    event: GameEvent,
    t: EcaLogText,
    nameOf: (playerId: unknown) => string,
): string | null {
    const p = event.payload ?? {};
    switch (event.type) {
        case "cardPlayed":
            return t("log_card_played", {
                name: nameOf(p.playerId),
                card: ecaCardLabel(p.card),
            });
        case "ruleFired":
            return t("log_rule_fired", {
                rule: typeof p.ruleName === "string" ? p.ruleName : "?",
            });
        case "cardsDrawn":
            return t("log_cards_drawn", {
                name: nameOf(p.playerId),
                count: typeof p.count === "number" ? p.count : 1,
            });
        case "directionReversed":
            return t("log_direction_reversed");
        case "playerSkipped":
            return t("log_player_skipped", { name: nameOf(p.playerId) });
        case "turnAdvanced":
            return t("log_turn_advanced", { name: nameOf(p.playerId) });
        case "gameEnded":
            return t("log_game_ended");
        default:
            return null;
    }
}
