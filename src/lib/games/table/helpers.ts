import type { CardDescriptor } from "@/lib/card/types";
import { cardKey, FACE_DOWN_CARD } from "@/lib/card/utils";
import type { GameAction } from "@/lib/engine/types";
import type {
    TableBanner,
    TableCardItem,
    TableContext,
    TableSeat,
} from "./types";

/** Live display name from the render context; "?" for unknown or malformed ids. */
export function playerName(ctx: TableContext, playerId: unknown): string {
    if (typeof playerId !== "string") return "?";
    return ctx.players.find((p) => p.userId === playerId)?.username ?? "?";
}

/**
 * Game over › spectating › your turn › waiting. `currentPlayerId === null`
 * (e.g. an optimistic prediction) reads as a plain "waiting".
 */
export function turnBanner(
    ctx: TableContext,
    currentPlayerId: string | null,
    yourTurnKey = "your_turn",
): TableBanner {
    if (ctx.isOver) return { label: ctx.t("game_over"), highlight: false };
    if (ctx.viewerId === null) {
        return { label: ctx.t("spectating"), highlight: false };
    }
    if (currentPlayerId === ctx.viewerId) {
        return { label: ctx.t(yourTurnKey), highlight: true };
    }
    return {
        label:
            currentPlayerId === null
                ? ctx.t("waiting")
                : ctx.t("waiting_for", {
                      name: playerName(ctx, currentPlayerId),
                  }),
        highlight: false,
    };
}

/** Opponent chips: every player but the viewer. */
export function seatChips<
    P extends { readonly playerId: string; readonly handCount: number },
>(
    players: readonly P[],
    ctx: TableContext,
    currentPlayerId: string | null,
    status: (player: P) => string | undefined,
): TableSeat[] {
    return players
        .filter((p) => p.playerId !== ctx.viewerId)
        .map((p) => ({
            playerId: p.playerId,
            name: playerName(ctx, p.playerId),
            handCount: p.handCount,
            isTurn: !ctx.isOver && p.playerId === currentPlayerId,
            status: status(p),
        }));
}

/** `count` face-down backs with ids `<prefix>:<i>`. */
export function faceDownPile(prefix: string, count: number): TableCardItem[] {
    return Array.from({ length: count }, (_, i) => ({
        id: `${prefix}:${i}`,
        card: FACE_DOWN_CARD,
        faceDown: true,
    }));
}

/**
 * One-tap hand: each card carries its legal action; with `flagIllegal` (the
 * viewer's turn) a card without one is marked illegal so a tap explains why.
 */
export function handFromActions(
    hand: readonly CardDescriptor[],
    actions: Iterable<GameAction & { readonly card: CardDescriptor }>,
    flagIllegal: boolean,
): TableCardItem[] {
    const byCard = new Map<string, GameAction>();
    for (const action of actions) byCard.set(cardKey(action.card), action);
    return hand.map((card) => {
        const action = byCard.get(cardKey(card));
        return {
            id: `hand:${cardKey(card)}`,
            card,
            action,
            illegal: flagIllegal && !action,
        };
    });
}
