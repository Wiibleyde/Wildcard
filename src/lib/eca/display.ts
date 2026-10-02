import { suitColor } from "@/lib/card/rank";
import type { CardDescriptor } from "@/lib/card/types";
import { isCardDescriptor, SUIT_SYMBOL } from "@/lib/card/utils";
import type { GameEvent } from "@/lib/engine/types";
import type { Translate } from "@/lib/games/table/types";

/** Narration shared by the live table log and the Studio sandbox. Pure. */

/** "7♥", or "?" for anything face-down or unknown. */
export function ecaCardLabel(value: unknown): string {
    return isCardDescriptor(value) && value.type === "suited"
        ? `${value.rank}${SUIT_SYMBOL[value.suit]}`
        : "?";
}

export function isRedSuit(card: CardDescriptor): boolean {
    return card.type === "suited" && suitColor(card.suit) === "red";
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

/**
 * Narrower than `Translate` on purpose: the Studio passes its typed
 * `useTranslations("studio")`, which only accepts known keys.
 */
type EcaLogText = (key: EcaLogKey, values?: Parameters<Translate>[1]) => string;

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
