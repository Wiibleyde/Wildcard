import type { CardDescriptor, Suit } from "@/lib/card/types";
import type { GameEvent } from "@/lib/engine/types";
import { isRecord } from "./schema";

/** Narration shared by the live table log and the Studio sandbox. Pure. */

const SUIT_GLYPH: Record<Suit, string> = {
    spades: "♠",
    hearts: "♥",
    diamonds: "♦",
    clubs: "♣",
};

function isSuitedCard(
    value: unknown,
): value is Extract<CardDescriptor, { type: "suited" }> {
    return (
        isRecord(value) &&
        value.type === "suited" &&
        typeof value.rank === "string" &&
        typeof value.suit === "string" &&
        Object.hasOwn(SUIT_GLYPH, value.suit)
    );
}

/** "7♥", or "?" for anything face-down or unknown. */
export function ecaCardLabel(value: unknown): string {
    return isSuitedCard(value) ? `${value.rank}${SUIT_GLYPH[value.suit]}` : "?";
}

export function isRedSuit(card: CardDescriptor): boolean {
    return (
        card.type === "suited" &&
        (card.suit === "hearts" || card.suit === "diamonds")
    );
}

/** Present in both the `game` and `studio` namespaces. */
type EcaLogKey =
    | "log_card_played"
    | "log_rule_fired"
    | "log_cards_drawn"
    | "log_direction_reversed"
    | "log_player_skipped"
    | "log_turn_advanced"
    | "log_game_ended";

type EcaLogText = (
    key: EcaLogKey,
    values?: Record<string, string | number>,
) => string;

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
