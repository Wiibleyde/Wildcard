export type GameErrorCode =
    | "not_found"
    | "unknown_game"
    | "version_conflict"
    | "rule_violation"
    | "invalid_action"
    | "db_error";

export const GAME_ERROR_STATUS: Record<GameErrorCode, number> = {
    not_found: 404,
    // The game exists but its module cannot be rebuilt: a server fault.
    unknown_game: 500,
    version_conflict: 409,
    rule_violation: 422,
    invalid_action: 400,
    db_error: 500,
};
